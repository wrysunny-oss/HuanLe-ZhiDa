import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {
  ATNative,
  ATNativeAdView,
  ATNativeCloseView,
  ATNativeCtaView,
  ATNativeDescView,
  ATNativeIconView,
  ATNativeMainImageView,
  ATNativeMediaView,
  ATNativeTitleView,
  NativeCallback,
  type NativeAd,
} from '@taku_anythink/react-native-sdk';
import {colors, radii, spacing, typography} from '../theme';
import {getAdRuntimeConfig} from '../native/ad-runtime';
import {reportAdEvent} from '../native/ad-telemetry';
import {reportTakuRevenue, takuAdProvider} from '../native/taku';
import {BrandLoader} from './BrandLoader';

const AD_HEIGHT = 280;

/** Taku 原生信息流；失败或关闭后折叠，不阻塞答题内容。 */
export function TakuFeedAd() {
  const {width: windowWidth} = useWindowDimensions();
  const [ad, setAd] = useState<NativeAd>();
  const [hidden, setHidden] = useState(false);
  const adRef = useRef<NativeAd | undefined>(undefined);
  const runtime = getAdRuntimeConfig();
  const placementId = runtime.feed.placementId;

  useEffect(() => {
    if (!runtime.enabled || !runtime.feed.enabled || !placementId) return;
    let cancelled = false;
    let loader: ATNative | undefined;

    takuAdProvider.initialize().then(() => {
      if (cancelled) return;
      reportAdEvent({format: 'FEED', eventType: 'REQUEST', placementId});
      loader = new ATNative(placementId, {
        onNativeAdLoaded: () => {
          loader?.getNativeAd().then(value => {
            if (!value || cancelled) {
              value?.destroy();
              return;
            }
            adRef.current = value;
            value.setAdRevenueListener(info => reportTakuRevenue('FEED', placementId, info));
            setAd(value);
            reportAdEvent({format: 'FEED', eventType: 'LOADED', placementId});
          }).catch(error => {
            reportAdEvent({format: 'FEED', eventType: 'FAIL', placementId, errorMessage: String(error)});
            setHidden(true);
          });
        },
        onNativeAdLoadFail: error => {
          if (__DEV__) console.warn('[Taku] 原生广告加载失败', error);
          reportAdEvent({format: 'FEED', eventType: 'FAIL', placementId, errorMessage: error.desc || error.fullErrorInfo});
          setHidden(true);
        },
      });
      loader.makeAdRequest();
    }).catch(error => {
      if (__DEV__) console.warn('[Taku] 原生广告初始化失败', error);
      reportAdEvent({format: 'FEED', eventType: 'FAIL', placementId, errorMessage: String(error)});
      setHidden(true);
    });

    return () => {
      cancelled = true;
      adRef.current?.destroy();
      adRef.current = undefined;
      loader?.dispose();
    };
  }, [placementId, runtime.enabled, runtime.feed.enabled]);

  if (hidden || !runtime.enabled || !runtime.feed.enabled) return null;
  const width = Math.min(windowWidth - spacing.lg * 2, 420);

  return (
    <View style={styles.section}>
      <View style={styles.captionRow}>
        <Text style={styles.caption}>广告</Text>
        <Text style={styles.hint}>推广内容</Text>
      </View>
      {!ad ? (
        <View style={[styles.container, styles.loading, {width, height: AD_HEIGHT}]}>
          <BrandLoader compact label="正在加载推荐内容" />
        </View>
      ) : (
        <ATNativeAdView
          ad={ad}
          adWidth={width}
          adHeight={AD_HEIGHT}
          style={[styles.container, {width, minHeight: AD_HEIGHT}]}
          onAdEvent={event => {
            if (event.callbackName === NativeCallback.show) {
              reportAdEvent({format: 'FEED', eventType: 'SHOW', placementId});
            } else if (event.callbackName === NativeCallback.click) {
              reportAdEvent({format: 'FEED', eventType: 'CLICK', placementId});
            } else if (event.callbackName === NativeCallback.close) {
              reportAdEvent({format: 'FEED', eventType: 'DISLIKE', placementId});
              setHidden(true);
            }
          }}>
          <View style={styles.adContent}>
            <ATNativeMainImageView resizeMode="cover" style={styles.mainImage} />
            <ATNativeMediaView style={styles.mainImage} />
            <View style={styles.body}>
              <ATNativeIconView style={styles.icon} />
              <View style={styles.copy}>
                <ATNativeTitleView numberOfLines={1} style={styles.title} />
                <ATNativeDescView numberOfLines={2} style={styles.description} />
              </View>
              <ATNativeCtaView numberOfLines={1} style={styles.cta} />
            </View>
            <ATNativeCloseView style={styles.close} />
          </View>
        </ATNativeAdView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {marginTop: spacing.xl, marginBottom: spacing.lg},
  captionRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm},
  caption: {color: colors.primary, ...typography.caption, paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.sm},
  hint: {color: colors.subtle, ...typography.caption},
  container: {alignSelf: 'center', overflow: 'hidden', borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface},
  loading: {alignItems: 'center', justifyContent: 'center'},
  adContent: {minHeight: AD_HEIGHT},
  mainImage: {width: '100%', height: 180, backgroundColor: colors.surfaceAlt},
  body: {minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md},
  icon: {width: 42, height: 42, borderRadius: 10, backgroundColor: colors.surfaceAlt},
  copy: {flex: 1, gap: 3},
  title: {color: colors.text, ...typography.label},
  description: {color: colors.muted, ...typography.caption},
  cta: {color: colors.onPrimary, backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, overflow: 'hidden', ...typography.caption, fontWeight: '700'},
  close: {position: 'absolute', top: spacing.sm, right: spacing.sm},
});
