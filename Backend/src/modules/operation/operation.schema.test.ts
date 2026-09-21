import assert from "node:assert/strict";
import test from "node:test";
import { adEventListQuerySchema, adEventSummaryQuerySchema, adRuntimeConfigSchema } from "./operation.schema.js";

const baseConfig = {
  enabled: true,
  splash: { enabled: true, placementId: "b6aae2bab20f22", timeoutMs: 3000, safetyTimeoutMs: 5000 },
  feed: { enabled: true, placementId: "b6aae2b1428a5d", insertEvery: 8 },
  banner: { enabled: true, placementId: "b6aae2baa6a957" },
  fullScreen: {
    enabled: true,
    placementId: "b6aae2baabf972",
    playbackThreshold: 5,
    minimumIntervalMinutes: 20,
    loadTimeoutMs: 8000,
    showTimeoutMs: 120000,
  },
  reward: { enabled: true, placementId: "b6aae2baa12ce8" },
};

test("广告运行配置兼容旧数据并默认使用手动加载", () => {
  const parsed = adRuntimeConfigSchema.parse(baseConfig);
  assert.equal(parsed.fullScreen.loadMode, "MANUAL");
  assert.equal(parsed.reward.loadMode, "MANUAL");
  assert.equal(parsed.reward.loadCooldownSeconds, 8);
});

test("Taku 插屏和激励视频可以独立切换自动加载", () => {
  const parsed = adRuntimeConfigSchema.parse({
    ...baseConfig,
    fullScreen: { ...baseConfig.fullScreen, loadMode: "AUTO" },
    reward: { ...baseConfig.reward, loadMode: "AUTO" },
  });
  assert.equal(parsed.fullScreen.loadMode, "AUTO");
  assert.equal(parsed.reward.loadMode, "AUTO");
  assert.equal(parsed.reward.loadCooldownSeconds, 8);
});

test("激励视频再次拉取间隔允许关闭并拒绝超出范围", () => {
  assert.equal(adRuntimeConfigSchema.parse({
    ...baseConfig,
    reward: { ...baseConfig.reward, loadCooldownSeconds: 0 },
  }).reward.loadCooldownSeconds, 0);
  assert.equal(adRuntimeConfigSchema.safeParse({
    ...baseConfig,
    reward: { ...baseConfig.reward, loadCooldownSeconds: 121 },
  }).success, false);
});

test("旧广告配置会补齐答题插屏频控默认值", () => {
  const parsed = adRuntimeConfigSchema.parse(baseConfig);
  assert.equal(parsed.fullScreen.quizRoundInterval, 3);
  assert.equal(parsed.fullScreen.dailyLimit, 5);
  assert.equal(parsed.fullScreen.skipFirstQuizRound, true);
});

test("答题插屏频控拒绝无效范围", () => {
  assert.equal(adRuntimeConfigSchema.safeParse({
    ...baseConfig,
    fullScreen: {...baseConfig.fullScreen, quizRoundInterval: 0},
  }).success, false);
  assert.equal(adRuntimeConfigSchema.safeParse({
    ...baseConfig,
    fullScreen: {...baseConfig.fullScreen, dailyLimit: 101},
  }).success, false);
});

test("广告事件查询默认统计最近 24 小时", () => {
  assert.deepEqual(adEventListQuerySchema.parse({}), { page: 1, pageSize: 20, hours: 24 });
  assert.deepEqual(adEventSummaryQuerySchema.parse({ hours: "168", format: "REWARD" }), { hours: 168, format: "REWARD" });
});

test("广告事件查询拒绝未开放的任意时间范围", () => {
  assert.equal(adEventListQuerySchema.safeParse({ hours: 12 }).success, false);
  assert.equal(adEventSummaryQuerySchema.safeParse({ hours: 721 }).success, false);
});

test("广告事件查询支持独立横幅类型", () => {
  assert.equal(adEventListQuerySchema.parse({ format: "BANNER" }).format, "BANNER");
});
