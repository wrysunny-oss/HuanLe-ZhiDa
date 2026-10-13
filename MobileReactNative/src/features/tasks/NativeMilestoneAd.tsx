import React, {useEffect, useRef, useState} from 'react';
import {AppState, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  ATNative,
  ATNativeAdView,
  ATNativeCtaView,
  ATNativeDescView,
  ATNativeIconView,
  ATNativeMainImageView,
  ATNativeMediaView,
  ATNativeTitleView,
  ATSDK,
  type NativeAd,
} from '@taku_anythink/react-native-sdk';
import {appApi} from '../../api/app';
import {takuAdProvider} from '../../native/taku';
import {ensureRiskAssessment} from '../../native/risk';
import type {RewardMilestone} from '../../types/api';

const NETWORK_IDS = ['8', '15', '28', '49', '66'];

function networkOf(info: Record<string, unknown>) {
  const value = info.network_firm_id ?? info.networkFirmId ?? info.network_firm_id_str;
  return value == null ? undefined : String(value);
}

function showIdOf(info: Record<string, unknown>) {
  const value = info.show_id ?? info.showId ?? info.request_id ?? info.requestId;
  return value == null ? undefined : String(value).slice(0, 100);
}

export function NativeMilestoneAd({item, onClose, onComplete}: {
  item: RewardMilestone;
  onClose: () => void;
  onComplete: (awardedCoins: string) => void;
}) {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [message, setMessage] = useState('正在准备原生广告…');
  const [remaining, setRemaining] = useState(15);
  const active = useRef(true);
  const finishRef = useRef(false);
  const loaderRef = useRef<ATNative | null>(null);
  const adRef = useRef<NativeAd | null>(null);
  const onCloseRef = useRef(onClose);
  const onCompleteRef = useRef(onComplete);
  onCloseRef.current = onClose;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    active.current = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const selected = item.networkFirmId ?? 'AUTO';
    const launch = async () => {
      try {
        await ensureRiskAssessment('reward');
        await takuAdProvider.initialize();
        const attempt = await appApi.startNativeAdTask(selected);
        if (!active.current) return;
        ATSDK.setFilterNetworkFirmIdList(attempt.placementId,
          selected === 'AUTO' ? [] : NETWORK_IDS.filter(id => id !== selected));
        const native = new ATNative(attempt.placementId, {
          onNativeAdLoaded: async () => {
            if (!active.current) return;
            if (timeout) clearTimeout(timeout);
            try {
              const loadedAd = await native.getNativeAd();
              if (!loadedAd) throw new Error('未取得可展示的原生广告');
              if (!active.current) { loadedAd.destroy(); return; }
              adRef.current = loadedAd;
              loadedAd.setNativeEventListener({
                onNativeAdShow: info => {
                  if (!active.current || finishRef.current || timer) return;
                  const actualNetworkId = networkOf(info);
                  if (selected !== 'AUTO' && actualNetworkId !== selected) {
                    setMessage('广告渠道与任务不符，本次不计进度');
                    return;
                  }
                  const shownAt = Date.now();
                  setMessage('广告已展示，请保持页面打开');
                  timer = setInterval(async () => {
                    if (!active.current || finishRef.current) return;
                    if (AppState.currentState !== 'active') {
                      clearInterval(timer!);
                      timer = undefined;
                      setMessage('页面离开前台，本次展示不计进度');
                      return;
                    }
                    const seconds = Math.floor((Date.now() - shownAt) / 1000);
                    setRemaining(Math.max(0, attempt.minShowSeconds - seconds));
                    if (seconds < attempt.minShowSeconds) return;
                    clearInterval(timer!);
                    timer = undefined;
                    finishRef.current = true;
                    setMessage('正在确认阶梯任务…');
                    try {
                      const result = await appApi.completeNativeAdTask({
                        attemptId: attempt.attemptId,
                        actualNetworkId: actualNetworkId && NETWORK_IDS.includes(actualNetworkId) ? actualNetworkId : undefined,
                        adShowId: showIdOf(info),
                      });
                      if (!active.current) return;
                      onCompleteRef.current(result.awardedCoins);
                      onCloseRef.current();
                    } catch (error) {
                      if (active.current) setMessage(error instanceof Error ? error.message : '任务确认失败');
                    }
                  }, 250);
                },
                onNativeAdClose: () => onCloseRef.current(),
              });
              setAd(loadedAd);
              setMessage('等待广告展示…');
            } catch (error) {
              if (active.current) setMessage(error instanceof Error ? error.message : '原生广告加载失败');
            }
          },
          onNativeAdLoadFail: error => {
            if (timeout) clearTimeout(timeout);
            if (active.current) setMessage(error.desc || '原生广告暂无填充，请稍后再试');
          },
        });
        loaderRef.current = native;
        timeout = setTimeout(() => {
          if (active.current && !adRef.current) setMessage('原生广告加载超时，请稍后重试');
        }, 30000);
        native.makeAdRequest();
      } catch (error) {
        if (active.current) setMessage(error instanceof Error ? error.message : '原生广告准备失败');
      }
    };
    launch();
    return () => {
      active.current = false;
      if (timer) clearInterval(timer);
      if (timeout) clearTimeout(timeout);
      adRef.current?.destroy();
      loaderRef.current?.dispose();
    };
  }, [item]);

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.heading}>原生广告任务</Text>
          <Pressable onPress={onClose}><Text style={styles.close}>关闭</Text></Pressable>
        </View>
        <Text style={styles.hint}>原生广告本身不结算金币；达到阶梯次数时发放额外奖励。</Text>
        {ad ? <ATNativeAdView ad={ad} style={styles.ad} adHeight={300}>
          <View style={styles.titleRow}>
            <ATNativeIconView style={styles.icon} />
            <ATNativeTitleView style={styles.title} />
          </View>
          <ATNativeDescView style={styles.desc} />
          <ATNativeMainImageView style={styles.media} resizeMode="cover" />
          <ATNativeMediaView style={styles.media} />
          <ATNativeCtaView style={styles.cta} />
        </ATNativeAdView> : null}
        <Text style={styles.status}>{message}{remaining > 0 && ad ? ` · ${remaining} 秒` : ''}</Text>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)'},
  sheet: {backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 420},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  heading: {fontSize: 18, fontWeight: '700', color: '#17233d'},
  close: {fontSize: 15, color: '#2871c5'},
  hint: {fontSize: 12, color: '#65758a', marginTop: 12, marginBottom: 16},
  ad: {minHeight: 230, width: '100%'},
  titleRow: {flexDirection: 'row', alignItems: 'center'},
  icon: {width: 40, height: 40, borderRadius: 8, marginRight: 10},
  title: {flex: 1, fontSize: 16, fontWeight: '600', color: '#17233d'},
  desc: {fontSize: 13, color: '#596579', marginTop: 8},
  media: {width: '100%', height: 180, marginTop: 10},
  cta: {fontSize: 15, color: '#2871c5', marginTop: 10},
  status: {fontSize: 13, color: '#42526b', marginTop: 18, textAlign: 'center'},
});
