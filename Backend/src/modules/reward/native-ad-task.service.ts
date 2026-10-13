import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/http.js";
import { advertisingProvider } from "../../generated/product.generated.js";
import { adMilestoneBizId, normalizeRewardMilestones } from "../admin/admin.service.js";
import { getAdRuntimeConfig } from "../operation/ad-runtime.service.js";
import { assertAllowed } from "../safety/safety.service.js";

const MIN_SHOW_SECONDS = 15;
const MAX_ATTEMPT_SECONDS = 300;

function intervalFor(milestones: ReturnType<typeof normalizeRewardMilestones>, networkId: string) {
  return Math.max(15, ...milestones
    .filter(item => networkId === "AUTO" || item.networkFirmId === "AUTO" || item.networkFirmId === networkId)
    .map(item => item.minIntervalSeconds ?? 60));
}

function dayRange(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = new Date(`${day}T00:00:00+08:00`);
  return { day: start.toISOString().slice(0, 10), start, end: new Date(start.getTime() + 86_400_000) };
}

async function taskConfig() {
  if (advertisingProvider !== "taku") throw new AppError(409, 3450, "当前广告平台不支持原生广告任务");
  const [runtime, config] = await Promise.all([
    getAdRuntimeConfig(),
    prisma.adRewardConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
  ]);
  if (!runtime.enabled || !runtime.feed.enabled) {
    throw new AppError(409, 3451, "原生广告任务未开放");
  }
  const milestones = normalizeRewardMilestones(config.rewardedAdMilestones).filter(item => item.adFormat === "NATIVE");
  if (!milestones.length) throw new AppError(409, 3452, "尚未配置原生广告阶梯任务");
  return { placementId: runtime.feed.placementId, dailyLimit: config.dailyRewardedAdLimit, milestones };
}

export async function startNativeAdTask(userId: bigint, selectedNetworkId: string) {
  await assertAllowed(userId, "reward");
  const config = await taskConfig();
  if (!config.milestones.some(item => item.networkFirmId === selectedNetworkId)) {
    throw new AppError(400, 3453, "未配置所选广告渠道的原生任务");
  }
  const now = new Date();
  const day = dayRange(now);
  const [user, completedToday, latest, pending] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, riskStatus: true } }),
    prisma.nativeAdTaskAttempt.count({ where: { userId, completedAt: { gte: day.start, lt: day.end } } }),
    prisma.nativeAdTaskAttempt.findFirst({ where: { userId, completedAt: { not: null } }, orderBy: { completedAt: "desc" } }),
    prisma.nativeAdTaskAttempt.count({ where: { userId, completedAt: null, startedAt: { gte: new Date(now.getTime() - MAX_ATTEMPT_SECONDS * 1000) } } }),
  ]);
  if (user.status !== "ACTIVE" || ["BANNED", "FROZEN", "REWARD_RESTRICTED"].includes(user.riskStatus)) throw new AppError(403, 3454, "当前账号不可领取奖励");
  if (completedToday >= config.dailyLimit) throw new AppError(429, 3455, "今日原生广告任务次数已达上限");
  if (pending >= 2) throw new AppError(429, 3456, "请先完成或等待已有广告任务过期");
  const interval = intervalFor(config.milestones, selectedNetworkId);
  if (latest?.completedAt && now.getTime() - latest.completedAt.getTime() < interval * 1000) {
    throw new AppError(429, 3457, `请等待 ${interval} 秒后再完成下一次原生广告任务`);
  }
  const attempt = await prisma.nativeAdTaskAttempt.create({ data: { userId, selectedNetworkId, placementId: config.placementId } });
  return { attemptId: attempt.id, placementId: config.placementId, minShowSeconds: MIN_SHOW_SECONDS, expiresInSeconds: MAX_ATTEMPT_SECONDS };
}

export async function completeNativeAdTask(userId: bigint, input: { attemptId: string; actualNetworkId?: string; adShowId?: string }) {
  await assertAllowed(userId, "reward");
  const config = await taskConfig();
  return prisma.$transaction(async tx => {
    const now = new Date();
    const day = dayRange(now);
    const attempt = await tx.nativeAdTaskAttempt.findUnique({ where: { id: input.attemptId } });
    if (!attempt || attempt.userId !== userId) throw new AppError(404, 3458, "广告任务凭证不存在");
    if (attempt.completedAt) throw new AppError(409, 3459, "此广告任务已完成");
    if (attempt.placementId !== config.placementId) throw new AppError(409, 3460, "广告位配置已变更");
    const elapsed = now.getTime() - attempt.startedAt.getTime();
    if (elapsed < MIN_SHOW_SECONDS * 1000 || elapsed > MAX_ATTEMPT_SECONDS * 1000) {
      throw new AppError(409, 3461, "广告展示时长不足或任务已过期");
    }
    if (attempt.selectedNetworkId !== "AUTO" && input.actualNetworkId !== attempt.selectedNetworkId) {
      throw new AppError(409, 3462, "广告实际渠道与任务渠道不符");
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, riskStatus: true } });
    if (user.status !== "ACTIVE" || ["BANNED", "FROZEN", "REWARD_RESTRICTED"].includes(user.riskStatus)) throw new AppError(403, 3454, "当前账号不可领取奖励");
    const [completedToday, latest] = await Promise.all([
      tx.nativeAdTaskAttempt.count({ where: { userId, completedAt: { gte: day.start, lt: day.end } } }),
      tx.nativeAdTaskAttempt.findFirst({ where: { userId, completedAt: { not: null } }, orderBy: { completedAt: "desc" } }),
    ]);
    if (completedToday >= config.dailyLimit) throw new AppError(429, 3455, "今日原生广告任务次数已达上限");
    const interval = intervalFor(config.milestones, input.actualNetworkId ?? attempt.selectedNetworkId);
    if (latest?.completedAt && now.getTime() - latest.completedAt.getTime() < interval * 1000) {
      throw new AppError(429, 3457, `请等待 ${interval} 秒后再完成下一次原生广告任务`);
    }
    const updated = await tx.nativeAdTaskAttempt.updateMany({ where: { id: attempt.id, completedAt: null }, data: {
      actualNetworkId: input.actualNetworkId ?? null, adShowId: input.adShowId ?? null, completedAt: now,
    } });
    if (updated.count !== 1) throw new AppError(409, 3459, "此广告任务已完成");
    let awardedCoins = 0n;
    for (const milestone of config.milestones) {
      const network = milestone.networkFirmId ?? "AUTO";
      if (network !== "AUTO" && network !== input.actualNetworkId) continue;
      const where: Prisma.NativeAdTaskAttemptWhereInput = { userId, completedAt: { not: null },
        ...(network === "AUTO" ? {} : { actualNetworkId: network }),
        ...(milestone.period === "DAILY" ? { AND: [{ completedAt: { gte: day.start } }, { completedAt: { lt: day.end } }] } : {}),
      };
      const count = await tx.nativeAdTaskAttempt.count({ where });
      if (count < milestone.count) continue;
      const bizId = adMilestoneBizId(userId, day.day, milestone);
      const claimed = await tx.rewardLedger.findUnique({ where: { type_bizId: { type: "TASK", bizId } } });
      if (claimed) continue;
      const coins = BigInt(milestone.rewardCoins);
      const updatedUser = await tx.user.update({ where: { id: userId }, data: { coinBalance: { increment: coins } }, select: { coinBalance: true } });
      await tx.rewardLedger.create({ data: { userId, type: "TASK", amount: coins, balanceAfter: updatedUser.coinBalance,
        title: `${milestone.period === "DAILY" ? "今日" : "累计"}原生广告 ${milestone.count} 次阶梯奖励`, bizId } });
      awardedCoins += coins;
    }
    const balance = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { coinBalance: true } });
    return { completed: true, awardedCoins, coinBalance: balance.coinBalance, nativeAdCountToday: completedToday + 1 };
  }, { isolationLevel: "Serializable" });
}

