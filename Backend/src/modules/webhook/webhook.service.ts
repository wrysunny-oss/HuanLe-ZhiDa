import { constants, createHash, createHmac, privateDecrypt, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Request } from "express";
import { env } from "../../config.js";
import { AppError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { settleRewardEvent, type RewardEvent } from "../advertising/reward-event.js";
import type { GroMoreRewardQuery, TakuRewardQuery } from "./webhook.schema.js";
import { verifyDramaUnlockIntent } from "../reward/ad-reward-intent.js";
import { getAdRuntimeConfig } from "../operation/ad-runtime.service.js";
import { productConfig } from "../../generated/product.generated.js";

const MAX_CLOCK_SKEW_SECONDS = 300;

/** 校验时间戳、来源 IP 和 HMAC，避免伪造请求及五分钟以外的重放请求。 */
export function verifyPangleSignature(request: Request) {
  const timestamp = request.header("x-pangle-timestamp") ?? "";
  const nonce = request.header("x-pangle-nonce") ?? "";
  const signature = request.header("x-pangle-signature") ?? "";
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > MAX_CLOCK_SKEW_SECONDS) {
    throw new AppError(401, 3601, "回调时间戳无效或已过期");
  }
  const allowedIps = env.PANGLE_CALLBACK_IPS.split(",").map((item) => item.trim()).filter(Boolean);
  if (allowedIps.length && !allowedIps.includes(request.ip ?? "")) throw new AppError(403, 3602, "回调来源 IP 不在白名单中");
  const expected = createHmac("sha256", env.PANGLE_CALLBACK_SECRET).update(`${timestamp}.${nonce}.${JSON.stringify(request.body)}`).digest("hex");
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (!nonce || actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new AppError(401, 3603, "回调签名验证失败");
  }
}

/** 先落接收日志，再使用 eventId 作为结算 requestId，重复回调只返回首次处理结果。 */
export async function receivePangleAdRevenue(input: { eventId: string; userId: bigint; revenueYuan: string; source: string }, request: Request) {
  const existing = await prisma.adCallbackLog.findUnique({ where: { eventId: input.eventId } });
  if (existing?.status === "SUCCESS") return { eventId: input.eventId, status: "SUCCESS", duplicate: true };
  if (existing?.status === "PROCESSING") throw new AppError(409, 3604, "该回调正在处理中");
  await prisma.adCallbackLog.upsert({
    where: { eventId: input.eventId },
    create: { eventId: input.eventId, status: "PROCESSING", payload: { ...input, userId: input.userId.toString() }, ip: request.ip },
    update: { status: "PROCESSING", reason: null, payload: { ...input, userId: input.userId.toString() }, ip: request.ip },
  });
  try {
    const event: RewardEvent = {
      provider: "pangle",
      eventId: input.eventId,
      userId: input.userId,
      revenueYuan: input.revenueYuan,
      source: input.source,
      format: "REWARD",
    };
    const settlement = await settleRewardEvent(event, request);
    await prisma.adCallbackLog.update({ where: { eventId: input.eventId }, data: { status: "SUCCESS" } });
    return { eventId: input.eventId, settlementId: settlement.id, status: "SUCCESS", duplicate: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 500) : "未知错误";
    await prisma.adCallbackLog.update({ where: { eventId: input.eventId }, data: { status: "FAILED", reason } });
    throw error;
  }
}

/** 后台分页查看成功、失败和处理中回调，便于运营排查平台对接问题。 */
export async function listCallbackLogs(query: { page: number; pageSize: number }) {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const [list, total, success, failed, processing, staleProcessing] = await prisma.$transaction([
    prisma.adCallbackLog.findMany({ skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { createdAt: "desc" } }),
    prisma.adCallbackLog.count(),
    prisma.adCallbackLog.count({ where: { status: "SUCCESS" } }),
    prisma.adCallbackLog.count({ where: { status: "FAILED" } }),
    prisma.adCallbackLog.count({ where: { status: "PROCESSING" } }),
    prisma.adCallbackLog.count({ where: { status: "PROCESSING", updatedAt: { lt: staleBefore } } }),
  ]);
  return { list, total, summary: { success, failed, processing, staleProcessing }, ...query };
}

/** GroMore 签名只覆盖交易号，规则为 sha256(m-key:trans_id)。 */
export function verifyGroMoreSign(transId: string, signature: string, securityKey = env.PANGLE_REWARD_SECURITY_KEY) {
  if (!securityKey) return false;
  const expected = createHash("sha256").update(`${securityKey}:${transId}`).digest("hex");
  const actualBuffer = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

/** Taku 严格按官方字段顺序拼接；是否携带 ilrd 会改变签名原文。 */
export function takuRewardSignatureText(input: Pick<TakuRewardQuery, "trans_id" | "placement_id" | "adsource_id" | "reward_amount" | "reward_name" | "ilrd">, securityKey: string) {
  const base = `trans_id=${input.trans_id}&placement_id=${input.placement_id}&adsource_id=${input.adsource_id}&reward_amount=${input.reward_amount}&reward_name=${input.reward_name}&sec_key=${securityKey}`;
  return input.ilrd === undefined ? base : `${base}&ilrd=${input.ilrd}`;
}

export function verifyTakuRewardSign(input: Pick<TakuRewardQuery, "trans_id" | "placement_id" | "adsource_id" | "reward_amount" | "reward_name" | "ilrd" | "sign">, securityKey = env.TAKU_CALLBACK_SECRET) {
  if (!securityKey) return false;
  const expected = createHash("md5").update(takuRewardSignatureText(input, securityKey)).digest("hex");
  const actualBuffer = Buffer.from(input.sign.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function takuPayload(input: TakuRewardQuery) {
  let ilrdSummary: {
    fields: string[];
    encryptedEcpmPresent: boolean;
    encryptedCnyEcpmPresent: boolean;
    secretIdPresent: boolean;
  } | undefined;
  if (input.ilrd !== undefined) {
    try {
      const parsed = JSON.parse(input.ilrd) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const fields = parsed as Record<string, unknown>;
        ilrdSummary = {
          fields: Object.keys(fields),
          encryptedEcpmPresent: typeof fields.e_c === "string" && fields.e_c.length > 0,
          encryptedCnyEcpmPresent: typeof fields.e_c_cny === "string" && fields.e_c_cny.length > 0,
          secretIdPresent: fields.s_id !== undefined && fields.s_id !== null,
        };
      }
    } catch {
      // Invalid ILRD is rejected during settlement; do not log its raw contents.
    }
  }
  return {
    ...input,
    user_id: input.user_id.toString(),
    sign: "[REDACTED]",
    ...(input.ilrd !== undefined ? { ilrd: ilrdSummary ?? "[INVALID_ILRD]" } : {}),
    ...(input.e_c ? { e_c: "[ENCRYPTED]" } : {}),
    ...(input.e_c_cny ? { e_c_cny: "[ENCRYPTED]" } : {}),
  };
}

/** Only signed ILRD encrypted fields may supplement the reward callback's top-level fields. */
export function resolveTakuEncryptedEcpm(input: TakuRewardQuery) {
  if (input.ilrd === undefined) return input;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.ilrd);
  } catch {
    throw new Error("Taku ILRD JSON is invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Taku ILRD must be an object");
  }
  const ilrd = parsed as Record<string, unknown>;
  if (String(ilrd.id ?? "") !== input.trans_id) throw new Error("Taku ILRD show ID mismatch");
  if (String(ilrd.adunit_id ?? "") !== input.placement_id) throw new Error("Taku ILRD placement ID mismatch");
  if (String(ilrd.adsource_id ?? "") !== input.adsource_id) throw new Error("Taku ILRD ad source ID mismatch");
  if (ilrd.adunit_format !== "RewardedVideo") throw new Error("Taku ILRD format mismatch");
  if (input.network_firm_id && String(ilrd.network_firm_id ?? "") !== input.network_firm_id) {
    throw new Error("Taku ILRD network ID mismatch");
  }
  for (const key of ["e_c", "e_c_cny", "s_id"] as const) {
    const nested = ilrd[key];
    if (nested !== undefined && nested !== null && typeof nested !== "string" && typeof nested !== "number") {
      throw new Error(`Taku ILRD ${key} type is invalid`);
    }
    if (input[key] !== undefined && nested !== undefined && String(input[key]) !== String(nested)) {
      throw new Error(`Taku ILRD ${key} mismatch`);
    }
  }
  return {
    ...input,
    e_c: input.e_c ?? (typeof ilrd.e_c === "string" ? ilrd.e_c : undefined),
    e_c_cny: input.e_c_cny ?? (typeof ilrd.e_c_cny === "string" ? ilrd.e_c_cny : undefined),
    s_id: input.s_id ?? (ilrd.s_id === undefined || ilrd.s_id === null ? undefined : String(ilrd.s_id)),
  };
}

function normalizePrivateKey(value: string) {
  const normalized = value.replace(/\\n/g, "\n").trim();
  if (normalized.includes("-----BEGIN")) return normalized;
  const body = normalized.replace(/\s/g, "").match(/.{1,64}/g)?.join("\n") ?? normalized;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

function parseKeyMap(raw: string | undefined, label: string) {
  if (!raw) return {} as Record<string, unknown>;
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label}必须是 JSON 对象`);
  return parsed as Record<string, unknown>;
}

export function parseTakuEcpmPrivateKeys(
  raw: string | undefined = env.TAKU_ECPM_PRIVATE_KEYS_JSON,
  fileRaw: string | undefined = env.TAKU_ECPM_PRIVATE_KEY_FILES_JSON,
) {
  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(parseKeyMap(raw, "Taku eCPM 私钥映射"))) {
    if (!/^\d+$/.test(id) || typeof value !== "string" || value.trim().length < 64) {
      throw new Error(`Taku eCPM 私钥配置无效：${id}`);
    }
    result[id] = normalizePrivateKey(value);
  }
  for (const [id, file] of Object.entries(parseKeyMap(fileRaw, "Taku eCPM 私钥文件映射"))) {
    if (!/^\d+$/.test(id) || typeof file !== "string" || !file.trim()) {
      throw new Error(`Taku eCPM 私钥文件配置无效：${id}`);
    }
    result[id] = normalizePrivateKey(readFileSync(resolve(file), "utf8"));
  }
  return result;
}

export function decryptTakuCnyEcpm(
  input: Pick<TakuRewardQuery, "adsource_id" | "e_c_cny" | "s_id">,
  privateKeys = parseTakuEcpmPrivateKeys(),
) {
  if (!input.e_c_cny || !input.s_id) throw new Error("Taku 回调缺少 e_c_cny 或 s_id");
  const privateKey = privateKeys[input.s_id];
  if (!privateKey) throw new Error(`Taku eCPM Key ID 未配置：${input.s_id}`);
  const encrypted = Buffer.from(input.e_c_cny.replace(/ /g, "+"), "base64");
  const plaintext = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    encrypted,
  ).toString("utf8");
  const parts = plaintext.split("_");
  if (parts.length < 2 || parts[0] !== input.adsource_id) throw new Error("Taku eCPM 广告源校验失败");
  const ecpm = parts[1] ?? "";
  if (!/^\d+(\.\d{1,8})?$/.test(ecpm) || Number(ecpm) <= 0 || Number(ecpm) > 1_000_000) {
    throw new Error("Taku eCPM 数值无效");
  }
  return { ecpmCny: ecpm, requestId: parts.slice(2).join("_") || undefined };
}

/** 人民币 eCPM（元/千次展示）换算为单次展示人民币金额，向下截断到百万分之一元。 */
export function takuCnyEcpmToRevenueYuan(ecpm: string) {
  const [integer = "0", fraction = ""] = ecpm.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const scaledEcpm = BigInt(integer) * scale + BigInt(fraction || "0");
  const revenueMicros = scaledEcpm * 1_000n / scale;
  return `${revenueMicros / 1_000_000n}.${(revenueMicros % 1_000_000n).toString().padStart(6, "0")}`;
}

async function recordRejectedTakuReward(input: TakuRewardQuery, request: Request, reason: string) {
  try {
    await prisma.adCallbackLog.create({
      data: {
        eventId: `taku:${input.trans_id}`,
        status: "FAILED",
        reason,
        payload: takuPayload(input),
        ip: request.ip,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
}

/** 记录在完整解析前就被拒绝的 Taku 请求；签名始终脱敏，后续同交易重试仍可正常认领。 */
export async function recordInvalidTakuReward(query: Request["query"], request: Request, invalidFields: string[]) {
  const rawTransactionId = typeof query.trans_id === "string" ? query.trans_id.trim() : "";
  const fallbackId = createHash("sha256")
    .update(`${request.ip ?? ""}:${request.originalUrl}`)
    .digest("hex")
    .slice(0, 32);
  const eventId = rawTransactionId && rawTransactionId.length <= 90
    ? `taku:${rawTransactionId}`
    : `taku-invalid:${fallbackId}`;
  const payload = Object.fromEntries(Object.entries(query).map(([key, value]) => [
    key,
    key === "sign" ? "[REDACTED]" : typeof value === "string" ? value : JSON.stringify(value),
  ]));
  const reason = `Taku 回调参数校验失败：${invalidFields.length ? invalidFields.join(", ") : "未知字段"}`;

  await prisma.adCallbackLog.upsert({
    where: { eventId },
    create: { eventId, status: "FAILED", reason, payload, ip: request.ip },
    update: { status: "FAILED", reason, payload, ip: request.ip },
  });
}

function takuExtraMatchesUser(extraData: string | undefined, userId: bigint) {
  if (!extraData) return true;
  try {
    const value = JSON.parse(extraData) as Record<string, unknown>;
    return value.userId === undefined || String(value.userId) === userId.toString();
  } catch {
    return true;
  }
}

/**
 * Taku 服务端激励：验签、校验广告位和用户上下文，再使用 trans_id 幂等结算。
 * reward_amount 是 Taku 后台配置并经 S2S 签名保护的最终用户金币数。
 */
export async function receiveTakuReward(input: TakuRewardQuery, request: Request) {
  if (!env.TAKU_CALLBACK_SECRET) {
    await recordRejectedTakuReward(input, request, "Taku 回调密钥未配置");
    return 602 as const;
  }
  if (!verifyTakuRewardSign(input)) {
    await recordRejectedTakuReward(input, request, "Taku 回调签名校验失败");
    return 601 as const;
  }

  const runtimeConfig = await getAdRuntimeConfig();
  if (!runtimeConfig.enabled || !runtimeConfig.reward.enabled || input.placement_id !== runtimeConfig.reward.placementId) {
    await recordRejectedTakuReward(input, request, `Taku 激励广告位未启用或不匹配：${input.placement_id}`);
    return 602 as const;
  }
  if (input.package_name && input.package_name !== productConfig.android.applicationId) {
    await recordRejectedTakuReward(input, request, `Taku Android 包名不匹配：${input.package_name}`);
    return 602 as const;
  }
  if (input.platform && input.platform !== "1") {
    await recordRejectedTakuReward(input, request, `Taku 回调平台不是 Android：${input.platform}`);
    return 602 as const;
  }
  if (!takuExtraMatchesUser(input.extra_data, input.user_id)) {
    await recordRejectedTakuReward(input, request, "Taku extra_data 用户与 user_id 不一致");
    return 602 as const;
  }

  const eventId = `taku:${input.trans_id}`;
  const payload = takuPayload(input);
  try {
    await prisma.adCallbackLog.create({ data: { eventId, status: "PROCESSING", payload, ip: request.ip } });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existing = await prisma.adCallbackLog.findUniqueOrThrow({ where: { eventId } });
    if (existing.status === "SUCCESS") return 200 as const;
    if (existing.status === "PROCESSING") return 602 as const;
    const claimed = await prisma.adCallbackLog.updateMany({
      where: { eventId, status: "FAILED" },
      data: { status: "PROCESSING", reason: null, payload, ip: request.ip },
    });
    if (claimed.count !== 1) return 602 as const;
  }

  try {
    const ecpmPrivateKeys = parseTakuEcpmPrivateKeys();
    const dynamicRevenueEnabled = Object.keys(ecpmPrivateKeys).length > 0;
    let revenueYuan = "0";
    if (dynamicRevenueEnabled) {
      try {
        const encryptedInfo = resolveTakuEncryptedEcpm(input);
        const { ecpmCny } = decryptTakuCnyEcpm(encryptedInfo, ecpmPrivateKeys);
        revenueYuan = takuCnyEcpmToRevenueYuan(ecpmCny);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Taku eCPM 解密失败";
        await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "FAILED", reason } });
        return 602 as const;
      }
    }

    const event: RewardEvent = {
      provider: "taku",
      eventId,
      userId: input.user_id,
      placementId: input.placement_id,
      revenueYuan,
      source: `TAKU:${input.network_firm_id || "UNKNOWN"}`.slice(0, 30),
      format: "REWARD",
      enforceDailyLimit: true,
      ...(dynamicRevenueEnabled ? {} : { verifiedAwardCoins: BigInt(input.reward_amount) }),
    };
    try {
      await settleRewardEvent(event, request);
    } catch (error) {
      if (error instanceof AppError && [3401, 3410, 3411].includes(error.code)) {
        await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "SUCCESS", reason: `REWARD_NO_COIN:${error.code}` } });
        return 200 as const;
      }
      throw error;
    }
    await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "SUCCESS" } });
    return 200 as const;
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 500) : "未知错误";
    await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "FAILED", reason } });
    return 602 as const;
  }
}

/**
 * GroMore eCPM 单位为“分/千次展示”。换算单次展示人民币收入：
 * ecpm(分) / 100(元) / 1000(次)，最终向下截断到项目支持的百万分之一元。
 */
export function groMoreEcpmToRevenueYuan(ecpmFen: string) {
  const [integer, fraction = ""] = ecpmFen.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const fenScaled = BigInt(integer!) * scale + BigInt(fraction || "0");
  const revenueMicros = fenScaled * 10n / scale;
  return `${revenueMicros / 1_000_000n}.${(revenueMicros % 1_000_000n).toString().padStart(6, "0")}`;
}

function groMoreRewardContext(extra: string | undefined, userId: bigint) {
  if (!extra) return { format: "REWARD" as const };
  try {
    const value = JSON.parse(extra) as Record<string, unknown>;
    if (value.source !== "content_unlock") return { format: "REWARD" as const };
    const intent = verifyDramaUnlockIntent(String(value.token ?? ""), userId);
    if (!intent || intent.dramaId !== String(value.dramaId ?? "") || intent.episodeIndex !== Number(value.episodeIndex ?? 0)) {
      return { format: "INVALID_CONTENT_UNLOCK" as const };
    }
    return { format: "CONTENT_UNLOCK" as const, contentType: "shortDrama" as const, contentId: intent.dramaId, unitId: String(intent.episodeIndex) };
  } catch {
    return { format: "REWARD" as const };
  }
}

async function recordRejectedGroMoreReward(input: GroMoreRewardQuery, request: Request, reason: string) {
  const payload = {...input, user_id: input.user_id.toString(), sign: '[REDACTED]'};
  try {
    await prisma.adCallbackLog.create({
      data: {
        eventId: `gromore:${input.trans_id}`,
        status: 'FAILED',
        reason,
        payload,
        ip: request.ip,
      },
    });
  } catch (error) {
    // 已存在的成功、处理中或失败记录都不能被无效重试覆盖。
    if ((error as {code?: string}).code !== 'P2002') throw error;
  }
}

/**
 * 处理 GroMore 官方激励回调。无论验证成功与否都返回平台约定结构；
 * trans_id 复用为结算 requestId，确保平台重试不会重复发放金币。
 */
export async function receiveGroMoreReward(input: GroMoreRewardQuery, request: Request) {
  if (!verifyGroMoreSign(input.trans_id, input.sign)) {
    await recordRejectedGroMoreReward(input, request, 'GroMore 回调签名校验失败');
    return { is_verify: false, reason: 40001 };
  }
  // prime_rit 是 GroMore 聚合广告位；mediation_rit 是本次命中的 ADN 代码位。
  // 后台配置的是聚合广告位，因此必须校验 prime_rit，不能拿代码位比较。
  const runtimeConfig = await getAdRuntimeConfig();
  if (input.prime_rit !== runtimeConfig.reward.placementId) {
    await recordRejectedGroMoreReward(input, request, `GroMore 聚合广告位不匹配：${input.prime_rit}`);
    return { is_verify: false, reason: 40002 };
  }
  if (!input.ecpm || Number(input.ecpm) <= 0) {
    await recordRejectedGroMoreReward(input, request, 'GroMore 回调缺少有效 eCPM');
    return { is_verify: false, reason: 40001 };
  }

  const eventId = `gromore:${input.trans_id}`;
  const payload = { ...input, user_id: input.user_id.toString(), sign: "[REDACTED]" };
  // 先通过 eventId 唯一索引抢占处理权，禁止两个并发回调同时进入金币结算。
  try {
    await prisma.adCallbackLog.create({ data: { eventId, status: "PROCESSING", payload, ip: request.ip } });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existing = await prisma.adCallbackLog.findUniqueOrThrow({ where: { eventId } });
    if (existing.status === "SUCCESS") return { is_verify: true, reason: 20000 };
    if (existing.status === "PROCESSING") return { is_verify: false, reason: 50001 };
    // 失败记录允许平台重试，但 updateMany 条件更新确保仍只有一个请求取得重试权。
    const claimed = await prisma.adCallbackLog.updateMany({
      where: { eventId, status: "FAILED" },
      data: { status: "PROCESSING", reason: null, payload, ip: request.ip },
    });
    if (claimed.count !== 1) return { is_verify: false, reason: 50001 };
  }
  try {
    const source = `GROMORE:${input.adn_name || "UNKNOWN"}`.slice(0, 30);
    const context = groMoreRewardContext(input.extra, input.user_id);
    if (context.format === "INVALID_CONTENT_UNLOCK") {
      throw new Error("内容解锁广告意图签名无效或已过期");
    }
    if (context.format === "CONTENT_UNLOCK") {
      const config = await prisma.adRewardConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
      // 关闭“短剧解锁发币”只影响平台金币分成，不能让已经完整观看广告的用户解锁失败。
      if (!config.dramaUnlockRewardEnabled) {
        await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "SUCCESS", reason: "CONTENT_UNLOCK_REWARD_DISABLED" } });
        return { is_verify: true, reason: 20000 };
      }
    }
    try {
      const event: RewardEvent = {
        provider: "gromore",
        eventId,
        userId: input.user_id,
        placementId: input.prime_rit,
        revenueYuan: groMoreEcpmToRevenueYuan(input.ecpm),
        source,
        format: context.format,
        enforceDailyLimit: true,
        ...(context.format === "CONTENT_UNLOCK" ? {
          context: {
            purpose: "CONTENT_UNLOCK" as const,
            contentType: context.contentType,
            contentId: context.contentId,
            unitId: context.unitId,
          },
        } : {}),
      };
      await settleRewardEvent(event, request);
    } catch (error) {
      // 风控或运营策略只限制金币，不撤销用户已经通过完整观看取得的剧集解锁资格。
      if (context.format === "CONTENT_UNLOCK" && error instanceof AppError && [3401, 3402, 3410, 3411].includes(error.code)) {
        await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "SUCCESS", reason: `CONTENT_UNLOCK_NO_COIN:${error.code}` } });
        return { is_verify: true, reason: 20000 };
      }
      throw error;
    }
    await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "SUCCESS" } });
    return { is_verify: true, reason: 20000 };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 500) : "未知错误";
    await prisma.adCallbackLog.update({ where: { eventId }, data: { status: "FAILED", reason } });
    return { is_verify: false, reason: 50002 };
  }
}
