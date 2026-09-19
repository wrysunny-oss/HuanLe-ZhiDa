import AsyncStorage from '@react-native-async-storage/async-storage';
import {appApi} from '../api/app';
import {adConfig} from '../config/ad-config';
import type {AdRuntimeConfig} from '../types/api';

const CACHE_KEY = 'hly_ad_runtime_config_v2';

const defaults: AdRuntimeConfig = {
  enabled: true,
  splash: {enabled: true, ...adConfig.splash},
  feed: {enabled: true, ...adConfig.feed},
  banner: {enabled: true, ...adConfig.banner},
  fullScreen: {
    enabled: true,
    placementId: adConfig.fullScreen.placementId,
    loadMode: 'MANUAL',
    playbackThreshold: adConfig.fullScreen.playbackThreshold,
    quizRoundInterval: adConfig.fullScreen.quizRoundInterval,
    dailyLimit: adConfig.fullScreen.dailyLimit,
    skipFirstQuizRound: adConfig.fullScreen.skipFirstQuizRound,
    minimumIntervalMinutes: adConfig.fullScreen.minimumIntervalMs / 60_000,
    loadTimeoutMs: adConfig.fullScreen.loadTimeoutMs,
    showTimeoutMs: adConfig.fullScreen.showTimeoutMs,
  },
  reward: {enabled: true, ...adConfig.reward, loadMode: 'MANUAL'},
};

let current: AdRuntimeConfig = defaults;

export function getAdRuntimeConfig() {
  return current;
}

function apply(value: AdRuntimeConfig | undefined) {
  if (!value?.splash || !value.feed || !value.fullScreen || !value.reward) return;
  // 广告位属于当前构建选择的厂商，不能被数据库中的旧厂商配置或本地缓存覆盖。
  current = {
    ...value,
    splash: {...defaults.splash, ...value.splash, placementId: adConfig.splash.placementId},
    feed: {...defaults.feed, ...value.feed, placementId: adConfig.feed.placementId},
    banner: {...defaults.banner, ...value.banner, placementId: adConfig.banner.placementId},
    fullScreen: {...defaults.fullScreen, ...value.fullScreen, placementId: adConfig.fullScreen.placementId},
    reward: {...defaults.reward, ...value.reward, placementId: adConfig.reward.placementId},
  };
}

/** 使用缓存立即启动，远端配置最多等待 2 秒，接口异常时保持安全默认值。 */
export async function refreshAdRuntimeConfig() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) apply(JSON.parse(cached) as AdRuntimeConfig);
  } catch {}

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const remote = await Promise.race([
      appApi.adConfig(),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 2000); }),
    ]);
    if (remote) {
      apply(remote);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)).catch(() => undefined);
    }
  } catch {
    // 缓存或默认配置已经可用，远端失败不阻塞启动。
  } finally {
    if (timer) clearTimeout(timer);
  }
  return current;
}
