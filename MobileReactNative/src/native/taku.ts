import {
  ATAdEvents,
  ATInterstitialAd,
  ATInterstitialAutoAd,
  ATRewardVideoAd,
  ATRewardVideoAutoAd,
  ATSDK,
  ATSplashAd,
  InitCallback,
  type ATAdInfo,
  type ATInterstitialListener,
  type ATRewardVideoListener,
} from '@taku_anythink/react-native-sdk';
import type {EcpmInfo, RewardVerify} from 'react-native-playnest-unionad';
import {adConfig} from '../config/ad-config';
import {appConfig} from '../config/app-config';
import {getAdRuntimeConfig} from './ad-runtime';
import {assertRewardLoadReady, recordRewardAdClosed} from './reward-load-cooldown';
import {reportAdEcpm, reportAdEvent} from './ad-telemetry';
import type {AdFormat, AdProvider, RewardLifecycle, RewardResult} from './ad-provider.types';

type AdState = 'idle' | 'loading' | 'ready' | 'showing';

const INIT_TIMEOUT_MS = 15_000;
const REWARD_LOAD_TIMEOUT_MS = 30_000;
const REWARD_SHOW_TIMEOUT_MS = 10 * 60_000;

let initialization: Promise<void> | undefined;
let state: AdState = 'idle';
let rewardAd: ATRewardVideoAd | undefined;
let rewardLifecycle: RewardLifecycle | undefined;
let rewardFormat: AdFormat = 'REWARD';
let rewardArrived = false;
let rewardInfo: ATAdInfo | undefined;
let rewardUserId = '';
let rewardEcpm: EcpmInfo | null = null;
let rewardAutoMode = false;
let autoRewardPlacementId: string | undefined;
let autoInterstitialPlacementId: string | undefined;
let pendingRewardShow:
  | {
      resolve: (result: RewardResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  | undefined;
let startupSplashPromise: Promise<void> | undefined;
let fullScreenPromise: Promise<boolean> | undefined;

function messageOf(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const value = error as {desc?: unknown; fullErrorInfo?: unknown; message?: unknown};
    return String(value.desc ?? value.fullErrorInfo ?? value.message ?? fallback);
  }
  return typeof error === 'string' && error ? error : fallback;
}

function firstString(info: ATAdInfo | undefined, keys: string[]) {
  for (const key of keys) {
    const value = info?.[key];
    if (value !== undefined && value !== null && String(value)) return String(value);
  }
  return '';
}

function toEcpmInfo(info?: ATAdInfo): EcpmInfo | null {
  if (!info) return null;
  const value: EcpmInfo = {
    adnName: firstString(info, ['network_name', 'networkName', 'adnName']),
    slotID: firstString(info, ['network_placement_id', 'networkPlacementId', 'slotID']),
    ecpm: firstString(info, ['publisher_revenue', 'publisherRevenue', 'ecpm']),
    requestID: firstString(info, ['request_id', 'requestId', 'requestID']),
    creativeID: firstString(info, ['creative_id', 'creativeId', 'creativeID']),
  };
  return Object.values(value).some(Boolean) ? value : null;
}

export function transactionIdOf(info?: ATAdInfo) {
  // Taku S2S 的 trans_id 对应展示级 showId；不同 SDK/桥接版本字段名存在差异。
  return firstString(info, ['id', 'show_id', 'showId', 'trans_id', 'transId']);
}

function debugRewardInfo(stage: 'show' | 'reward', info?: ATAdInfo) {
  if (!__DEV__) return;
  console.info(`[Taku reward] ${stage} callback fields`, {
    showIdPresent: Boolean(transactionIdOf(info)),
    requestIdPresent: Boolean(firstString(info, ['request_id', 'requestId', 'requestID'])),
    encryptedEcpmPresent: Boolean(firstString(info, ['e_c'])),
    secretIdPresent: Boolean(firstString(info, ['s_id'])),
    encryptedCnyEcpmPresent: Boolean(firstString(info, ['e_c_cny'])),
  });
}

export function reportTakuRevenue(format: 'SPLASH' | 'FEED' | 'BANNER' | 'FULL_SCREEN' | AdFormat, placementId: string, info: ATAdInfo) {
  const value = toEcpmInfo(info);
  if (value) reportAdEcpm(format, placementId, value);
  return value;
}

function resetRewardSession() {
  rewardAd?.removeAdListener();
  if (rewardAutoMode && autoRewardPlacementId) {
    ATRewardVideoAutoAd.removeAdListener(autoRewardPlacementId);
    ATAdEvents.removeRevenueListener(autoRewardPlacementId);
  }
  rewardAd = undefined;
  rewardLifecycle = undefined;
  rewardFormat = 'REWARD';
  rewardArrived = false;
  rewardInfo = undefined;
  rewardUserId = '';
  rewardEcpm = null;
  rewardAutoMode = false;
  state = 'idle';
}

function finishRewardShow(error?: Error) {
  const pending = pendingRewardShow;
  pendingRewardShow = undefined;
  if (!pending) {
    resetRewardSession();
    return;
  }
  clearTimeout(pending.timeout);
  if (error) {
    pending.reject(error);
  } else {
    pending.resolve({
      completed: rewardArrived,
      rewardArrived,
      skipped: !rewardArrived,
      transactionId: transactionIdOf(rewardInfo),
      placementId: getAdRuntimeConfig().reward.placementId,
      rewardAmount: 0,
      rewardName: '金币',
      ecpm: rewardEcpm,
    });
  }
  resetRewardSession();
}

/** Taku 只会在用户同意隐私协议后初始化；App Key 来自 Android 本地构建配置。 */
export const takuAdProvider: AdProvider = {
  name: 'taku',
  available: true,
  get state() {
    return state;
  },
  initialize: () => {
    if (initialization) return initialization;
    if (!adConfig.appId || !appConfig.takuAppKey) {
      return Promise.reject(new Error('Taku App ID 或 App Key 尚未配置'));
    }

    initialization = new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ATAdEvents.removeGlobalListener(onEvent);
        if (error) reject(error);
        else resolve();
      };
      const onEvent = (event: {callbackName: string; requestMessage?: string}) => {
        if (event.callbackName === InitCallback.sdkInitSuccess) {
          ATSDK.start();
          finish();
        } else if (event.callbackName === InitCallback.sdkInitFail) {
          finish(new Error(event.requestMessage || 'Taku SDK 初始化失败'));
        }
      };
      const timer = setTimeout(() => finish(new Error('Taku SDK 初始化超时')), INIT_TIMEOUT_MS);
      ATAdEvents.init();
      ATAdEvents.addGlobalListener(onEvent);
      ATSDK.setNetworkLogDebug(__DEV__);
      ATSDK.init(adConfig.appId, appConfig.takuAppKey);
    }).catch(error => {
      initialization = undefined;
      throw error;
    });
    return initialization;
  },
  showStartupSplash: () => {
    const runtime = getAdRuntimeConfig();
    if (!runtime.enabled || !runtime.splash.enabled) return Promise.resolve();
    if (startupSplashPromise) return startupSplashPromise;

    startupSplashPromise = takuAdProvider.initialize().then(() => new Promise<void>(resolve => {
      const placementId = runtime.splash.placementId;
      const splash = new ATSplashAd(placementId);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        splash.removeAdListener();
        resolve();
      };
      const fail = (error: unknown) => {
        reportAdEvent({format: 'SPLASH', eventType: 'FAIL', placementId, errorMessage: messageOf(error, '开屏广告失败')});
        finish();
      };
      const safetyTimer = setTimeout(finish, runtime.splash.safetyTimeoutMs);
      splash.setAdRevenueListener(info => reportTakuRevenue('SPLASH', placementId, info));
      splash.setAdListener({
        onSplashAdLoaded: () => {
          reportAdEvent({format: 'SPLASH', eventType: 'LOADED', placementId});
          splash.show();
        },
        onSplashAdLoadFail: fail,
        onSplashAdTimeout: finish,
        onSplashAdShow: () => {
          reportAdEvent({format: 'SPLASH', eventType: 'SHOW', placementId});
        },
        onSplashAdShowFailed: fail,
        onSplashAdClick: () => reportAdEvent({format: 'SPLASH', eventType: 'CLICK', placementId}),
        onSplashAdClose: () => {
          reportAdEvent({format: 'SPLASH', eventType: 'CLOSE', placementId});
          finish();
        },
      });
      reportAdEvent({format: 'SPLASH', eventType: 'REQUEST', placementId});
      splash.load(undefined, runtime.splash.timeoutMs);
    })).catch(error => {
      if (__DEV__) console.warn('[Taku] 开屏广告流程失败', error);
    });
    return startupSplashPromise;
  },
  showFullScreen: () => {
    const runtime = getAdRuntimeConfig();
    if (!runtime.enabled || !runtime.fullScreen.enabled || state !== 'idle') return Promise.resolve(false);
    if (fullScreenPromise) return fullScreenPromise;

    fullScreenPromise = takuAdProvider.initialize().then(() => new Promise<boolean>(resolve => {
      const placementId = runtime.fullScreen.placementId;
      const autoLoad = runtime.fullScreen.loadMode === 'AUTO';
      const interstitial = new ATInterstitialAd(placementId);
      let settled = false;
      let shown = false;
      let showRequested = false;
      let showTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (didShow: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(loadTimer);
        if (showTimer) clearTimeout(showTimer);
        if (autoLoad) {
          ATInterstitialAutoAd.removeAdListener(placementId);
          ATAdEvents.removeRevenueListener(placementId);
        } else {
          interstitial.removeAdListener();
        }
        resolve(didShow);
      };
      const fail = (error: unknown) => {
        reportAdEvent({format: 'FULL_SCREEN', eventType: 'FAIL', placementId, errorMessage: messageOf(error, '插屏广告失败')});
        finish(shown);
      };
      const loadTimer = setTimeout(() => finish(false), runtime.fullScreen.loadTimeoutMs);
      const show = () => {
        if (showRequested || settled) return;
        showRequested = true;
        clearTimeout(loadTimer);
        showTimer = setTimeout(() => finish(shown), runtime.fullScreen.showTimeoutMs);
        const result = autoLoad ? ATInterstitialAutoAd.show(placementId) : interstitial.show();
        Promise.resolve(result).catch(fail);
      };
      const listener: ATInterstitialListener = {
        onInterstitialAdLoaded: () => {
          reportAdEvent({format: 'FULL_SCREEN', eventType: 'LOADED', placementId});
          show();
        },
        onInterstitialAdLoadFail: fail,
        onInterstitialAdShowFailed: fail,
        onInterstitialAdShow: info => {
          shown = true;
          reportAdEvent({format: 'FULL_SCREEN', eventType: 'SHOW', placementId});
          reportTakuRevenue('FULL_SCREEN', placementId, info);
        },
        onInterstitialAdClicked: () => reportAdEvent({format: 'FULL_SCREEN', eventType: 'CLICK', placementId}),
        onInterstitialAdClose: () => {
          reportAdEvent({format: 'FULL_SCREEN', eventType: 'CLOSE', placementId});
          finish(shown);
        },
      };
      reportAdEvent({format: 'FULL_SCREEN', eventType: 'REQUEST', placementId});
      if (autoLoad) {
        if (autoInterstitialPlacementId && autoInterstitialPlacementId !== placementId) {
          ATInterstitialAutoAd.removePlacement(autoInterstitialPlacementId);
        }
        autoInterstitialPlacementId = placementId;
        ATInterstitialAutoAd.setAdListener(placementId, listener);
        ATAdEvents.setRevenueListener(placementId, info => reportTakuRevenue('FULL_SCREEN', placementId, info));
        ATInterstitialAutoAd.addPlacement(placementId);
        if (ATInterstitialAutoAd.isAdReady(placementId)) show();
      } else {
        if (autoInterstitialPlacementId) {
          ATInterstitialAutoAd.removePlacement(autoInterstitialPlacementId);
          autoInterstitialPlacementId = undefined;
        }
        interstitial.setAdListener(listener);
        interstitial.load();
      }
    })).catch(error => {
      if (__DEV__) console.warn('[Taku] 插屏广告流程失败', error);
      return false;
    }).finally(() => {
      fullScreenPromise = undefined;
    });
    return fullScreenPromise;
  },
  loadReward: async (userId, extra = '', format: AdFormat = 'REWARD', lifecycle?: RewardLifecycle) => {
    const runtime = getAdRuntimeConfig();
    if (!runtime.enabled || !runtime.reward.enabled) throw new Error('激励广告暂未开放');
    if (state !== 'idle' || fullScreenPromise) throw new Error('已有广告正在加载或展示');
    await assertRewardLoadReady(userId, runtime.reward.loadCooldownSeconds);
    await takuAdProvider.initialize();

    state = 'loading';
    rewardUserId = userId;
    rewardFormat = format;
    rewardLifecycle = lifecycle;
    rewardArrived = false;
    rewardInfo = undefined;
    rewardEcpm = null;
    const placementId = runtime.reward.placementId;
    let selectedNetwork = 'AUTO';
    try {
      selectedNetwork = String((JSON.parse(extra) as {networkFirmId?: string}).networkFirmId ?? 'AUTO');
    } catch {
      // Other reward entry points do not require a network filter.
    }
    const networkIds = ['8', '15', '28', '49', '66'];
    ATSDK.setFilterNetworkFirmIdList(placementId,
      networkIds.includes(selectedNetwork) ? networkIds.filter(id => id !== selectedNetwork) : []);
    const autoLoad = runtime.reward.loadMode === 'AUTO';
    rewardAutoMode = autoLoad;
    const localExtra = {
      // Taku Android ATAdConst.KEY values. The iOS-style
      // kATAdLoadingExtra... names are not recognized by the Android SDK.
      user_id: userId,
      user_custom_data: extra,
    };
    rewardAd = autoLoad ? undefined : new ATRewardVideoAd(placementId);
    rewardAd?.setLocalExtra(localExtra);
    reportAdEvent({format, eventType: 'REQUEST', placementId});

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finishLoad = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) {
          resetRewardSession();
          reject(error);
        } else {
          state = 'ready';
          resolve();
        }
      };
      const timeout = setTimeout(
        () => finishLoad(new Error('激励视频加载超时，请稍后重试')),
        REWARD_LOAD_TIMEOUT_MS,
      );
      const listener: ATRewardVideoListener = {
        onRewardedVideoAdLoaded: () => {
          reportAdEvent({format, eventType: 'LOADED', placementId});
          finishLoad();
        },
        onRewardedVideoAdFailed: error => finishLoad(new Error(messageOf(error, '激励视频加载失败'))),
        onRewardedVideoAdPlayStart: info => {
          debugRewardInfo('show', info);
          reportAdEvent({format: rewardFormat, eventType: 'SHOW', placementId});
          rewardEcpm = reportTakuRevenue(rewardFormat, placementId, info);
          rewardLifecycle?.onEcpm?.(rewardEcpm);
        },
        onRewardedVideoAdPlayClicked: () => reportAdEvent({format: rewardFormat, eventType: 'CLICK', placementId}),
        onRewardedVideoAdPlayFailed: error => finishRewardShow(new Error(messageOf(error, '激励视频播放失败'))),
        onReward: info => {
          debugRewardInfo('reward', info);
          rewardArrived = true;
          rewardInfo = info;
          const signal: RewardVerify = {
            rewardVerify: true,
            rewardAmount: 0,
            rewardName: '金币',
            errorCode: 0,
            error: '',
            transactionId: transactionIdOf(info),
          };
          rewardLifecycle?.onRewardSignal?.(signal);
          reportAdEvent({format: rewardFormat, eventType: 'REWARD_ARRIVED', placementId, requestId: signal.transactionId});
        },
        onRewardFailed: info => {
          rewardInfo = info;
        },
        onRewardedVideoAdClosed: info => {
          recordRewardAdClosed(rewardUserId);
          if (rewardAutoMode) ATRewardVideoAutoAd.removePlacement(placementId);
          rewardInfo ??= info;
          reportAdEvent({format: rewardFormat, eventType: 'CLOSE', placementId});
          finishRewardShow();
        },
      };
      const onRevenue = (info: ATAdInfo) => {
        rewardEcpm = reportTakuRevenue(rewardFormat, placementId, info);
        rewardLifecycle?.onEcpm?.(rewardEcpm);
      };
      if (autoLoad) {
        if (autoRewardPlacementId && autoRewardPlacementId !== placementId) {
          ATRewardVideoAutoAd.removePlacement(autoRewardPlacementId);
        }
        autoRewardPlacementId = placementId;
        ATRewardVideoAutoAd.setAdListener(placementId, listener);
        ATAdEvents.setRevenueListener(placementId, onRevenue);
        ATRewardVideoAutoAd.addPlacement(placementId, localExtra);
        if (ATRewardVideoAutoAd.isAdReady(placementId)) finishLoad();
      } else {
        if (autoRewardPlacementId) {
          ATRewardVideoAutoAd.removePlacement(autoRewardPlacementId);
          autoRewardPlacementId = undefined;
        }
        rewardAd!.setAdListener(listener);
        rewardAd!.setAdRevenueListener(onRevenue);
        rewardAd!.load();
      }
    });
  },
  showReward: async () => {
    if (state !== 'ready' || (!rewardAutoMode && !rewardAd)) throw new Error('激励视频尚未加载完成');
    state = 'showing';
    return new Promise<RewardResult>((resolve, reject) => {
      pendingRewardShow = {
        resolve,
        reject,
        timeout: setTimeout(() => finishRewardShow(new Error('激励视频展示超时')), REWARD_SHOW_TIMEOUT_MS),
      };
      const placementId = getAdRuntimeConfig().reward.placementId;
      const result = rewardAutoMode
        ? ATRewardVideoAutoAd.show(placementId)
        : rewardAd!.show();
      Promise.resolve(result).catch(error => finishRewardShow(error instanceof Error ? error : new Error(String(error))));
    });
  },
  setRewardLifecycle: lifecycle => {
    if (state === 'idle') throw new Error('激励视频尚未加载');
    rewardLifecycle = lifecycle;
  },
  dispose: () => {
    if (pendingRewardShow) finishRewardShow(new Error('激励视频已取消'));
    else resetRewardSession();
  },
};
