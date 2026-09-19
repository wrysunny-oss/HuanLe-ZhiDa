import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import {advertisingProvider, productConfig, productModules} from "../../generated/product.generated.js";
import {
  adRuntimeConfigSchema,
  type AdRuntimeConfig,
} from "./operation.schema.js";

export const AD_RUNTIME_CONFIG_KEY = "ads.runtime_config";

type ProviderPlacementConfig = {
  splashPlacementId: string;
  feedPlacementId: string;
  bannerPlacementId?: string;
  fullScreenPlacementId: string;
  rewardPlacementId: string;
};
const providerConfigs = productConfig.advertising.providers as Partial<Record<string, ProviderPlacementConfig>>;
const providerConfig = providerConfigs[advertisingProvider];

export const defaultAdRuntimeConfig: AdRuntimeConfig = {
  enabled: productModules.advertising,
  splash: { enabled: true, placementId: providerConfig?.splashPlacementId ?? "000000", timeoutMs: 3000, safetyTimeoutMs: 5000 },
  feed: { enabled: true, placementId: providerConfig?.feedPlacementId ?? "000000", insertEvery: 8 },
  banner: { enabled: true, placementId: providerConfig?.bannerPlacementId ?? "000000" },
  fullScreen: {
    enabled: true,
    placementId: providerConfig?.fullScreenPlacementId ?? "000000",
    loadMode: "MANUAL",
    playbackThreshold: 5,
    quizRoundInterval: 3,
    dailyLimit: 5,
    skipFirstQuizRound: true,
    minimumIntervalMinutes: 20,
    loadTimeoutMs: 8000,
    showTimeoutMs: 120000,
  },
  reward: { enabled: true, placementId: providerConfig?.rewardPlacementId ?? "000000", loadMode: "MANUAL" },
};

function useCurrentProviderPlacements(config: AdRuntimeConfig): AdRuntimeConfig {
  return {
    ...config,
    splash: { ...config.splash, placementId: defaultAdRuntimeConfig.splash.placementId },
    feed: { ...config.feed, placementId: defaultAdRuntimeConfig.feed.placementId },
    banner: { ...config.banner, placementId: defaultAdRuntimeConfig.banner.placementId },
    fullScreen: { ...config.fullScreen, placementId: defaultAdRuntimeConfig.fullScreen.placementId },
    reward: { ...config.reward, placementId: defaultAdRuntimeConfig.reward.placementId },
  };
}

export async function getAdRuntimeConfig() {
  const stored = await prisma.systemConfig.findUnique({ where: { key: AD_RUNTIME_CONFIG_KEY } });
  const value = stored?.value && typeof stored.value === "object" && !Array.isArray(stored.value)
    ? stored.value as Record<string, unknown>
    : {};
  const parsed = adRuntimeConfigSchema.safeParse({
    ...defaultAdRuntimeConfig,
    ...value,
  });
  return useCurrentProviderPlacements(parsed.success ? parsed.data : defaultAdRuntimeConfig);
}

export async function recordAdClientEvent(
  data: {
    format: string; eventType: string; placementId: string;
    requestId?: string | null; creativeId?: string | null; adnName?: string | null;
    ecpm?: string | null; errorMessage?: string | null;
  },
  request: Pick<Request, "header">,
) {
  const deviceId = request.header("x-device-id")?.trim();
  await prisma.adClientEvent.create({
    data: {
      format: data.format,
      eventType: data.eventType,
      placementId: data.placementId,
      requestId: data.requestId || null,
      creativeId: data.creativeId || null,
      adnName: data.adnName || null,
      ecpm: data.ecpm ? data.ecpm : null,
      errorMessage: data.errorMessage || null,
      deviceHash: deviceId ? createHash("sha256").update(deviceId).digest("hex") : null,
      platform: request.header("x-platform")?.slice(0, 30),
      appVersion: request.header("x-app-version")?.slice(0, 30),
    },
  });
  return { accepted: true };
}

type AdEventQuery = { page: number; pageSize: number; hours: number; format?: string; eventType?: string };

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator * 100).toFixed(2)) : 0;
}

export async function listAdClientEvents(query: AdEventQuery) {
  const since = new Date(Date.now() - query.hours * 60 * 60_000);
  const where: Prisma.AdClientEventWhereInput = {
    createdAt: { gte: since },
    ...(query.format ? { format: query.format } : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
  };
  const [list, total] = await prisma.$transaction([
    prisma.adClientEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.adClientEvent.count({ where }),
  ]);
  return { list, total, page: query.page, pageSize: query.pageSize, since };
}

export async function getAdClientEventSummary(query: { hours: number; format?: string }) {
  const until = new Date();
  const since = new Date(until.getTime() - query.hours * 60 * 60_000);
  const where: Prisma.AdClientEventWhereInput = {
    createdAt: { gte: since },
    ...(query.format ? { format: query.format } : {}),
  };
  const [grouped, groupedFailures] = await Promise.all([
    prisma.adClientEvent.groupBy({
      by: ["format", "eventType"],
      where,
      _count: { _all: true },
    }),
    prisma.adClientEvent.groupBy({
      by: ["format", "errorMessage"],
      where: { ...where, eventType: "FAIL" },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  const events = grouped.map(item => ({ format: item.format, eventType: item.eventType, count: item._count._all }));
  const eventCount = (eventType: string) => events
    .filter(item => item.eventType === eventType)
    .reduce((sum, item) => sum + item.count, 0);
  const totals = {
    requests: eventCount("REQUEST"), loaded: eventCount("LOADED"), shows: eventCount("SHOW"),
    clicks: eventCount("CLICK"), failures: eventCount("FAIL"), ecpmReports: eventCount("ECPM"),
  };
  const formats = [...new Set(events.map(item => item.format))];
  const byFormat = formats.map((format) => {
    const count = (eventType: string) => events.find(item => item.format === format && item.eventType === eventType)?.count ?? 0;
    const requests = count("REQUEST");
    const loaded = count("LOADED");
    const shows = count("SHOW");
    const clicks = count("CLICK");
    const failures = count("FAIL");
    return {
      format, requests, loaded, shows, clicks, failures, ecpmReports: count("ECPM"),
      loadRate: rate(loaded, requests), showRate: rate(shows, loaded), clickRate: rate(clicks, shows), failureRate: rate(failures, requests),
    };
  });
  const failures = groupedFailures
    .map(item => ({
      format: item.format,
      errorMessage: item.errorMessage || "未上报错误详情",
      count: item._count._all,
      lastOccurredAt: item._max.createdAt,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
  return {
    since, until, hours: query.hours, events, totals, byFormat, failures,
    rates: {
      loadRate: rate(totals.loaded, totals.requests), showRate: rate(totals.shows, totals.loaded),
      clickRate: rate(totals.clicks, totals.shows), failureRate: rate(totals.failures, totals.requests),
    },
  };
}
