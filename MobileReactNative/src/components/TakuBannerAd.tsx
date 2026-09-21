import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {
  ATBannerView,
  ATBannerViewComponent,
} from '@taku_anythink/react-native-sdk';
import {adConfig} from '../config/ad-config';
import {colors, radii, spacing, typography} from '../theme';
import {getAdRuntimeConfig} from '../native/ad-runtime';
import {reportAdEvent} from '../native/ad-telemetry';
import {reportTakuRevenue, takuAdProvider} from '../native/taku';
import {useDeferredAdMount} from './useDeferredAdMount';

const HEIGHT = 50;

/** 可复用的 Taku 横幅组件；当前页面未投放时不会自行占位。 */
export function TakuBannerAd() {
  const {width: windowWidth} = useWindowDimensions();
  const [hidden, setHidden] = useState(false);
  const controller = useRef<ATBannerView | undefined>(undefined);
  const runtime = getAdRuntimeConfig();
  const placementId = adConfig.banner.placementId;
  const width = Math.min(windowWidth - spacing.lg * 2, 420);
  const enabled = runtime.enabled && runtime.banner.enabled && Boolean(placementId);
  const mountReady = useDeferredAdMount(enabled);

  useEffect(() => {
    if (!mountReady || !placementId) return;
    const banner = new ATBannerView();
    controller.current = banner;
    takuAdProvider.initialize().then(() => {
      banner.setPlacementId(placementId);
      banner.setBannerAdListener({
        onBannerAdLoaded: () => reportAdEvent({format: 'BANNER', eventType: 'LOADED', placementId}),
        onBannerAdShow: () => reportAdEvent({format: 'BANNER', eventType: 'SHOW', placementId}),
        onBannerAdClicked: () => reportAdEvent({format: 'BANNER', eventType: 'CLICK', placementId}),
        onBannerAdClose: () => {
          reportAdEvent({format: 'BANNER', eventType: 'CLOSE', placementId});
          setHidden(true);
        },
        onBannerAdLoadFail: error => {
          reportAdEvent({format: 'BANNER', eventType: 'FAIL', placementId, errorMessage: error.desc || error.fullErrorInfo});
          setHidden(true);
        },
        onBannerAdAutoRefreshed: () => reportAdEvent({format: 'BANNER', eventType: 'SHOW', placementId}),
        onBannerAdAutoRefreshFail: error => reportAdEvent({format: 'BANNER', eventType: 'FAIL', placementId, errorMessage: error.desc || error.fullErrorInfo}),
      });
      banner.setAdRevenueListener(info => reportTakuRevenue('BANNER', placementId, info));
      reportAdEvent({format: 'BANNER', eventType: 'REQUEST', placementId});
      banner.loadAd(undefined, {width, height: HEIGHT});
    }).catch(error => {
      reportAdEvent({format: 'BANNER', eventType: 'FAIL', placementId, errorMessage: String(error)});
      setHidden(true);
    });
    return () => {
      banner.destroy();
      controller.current = undefined;
    };
  }, [mountReady, placementId, width]);

  if (hidden || !mountReady || !placementId) return null;
  return (
    <View style={styles.wrapper}>
      <Text style={styles.caption}>广告</Text>
      <ATBannerViewComponent
        placementID={placementId}
        width={width}
        height={HEIGHT}
        style={{width, height: HEIGHT}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {alignItems: 'center', alignSelf: 'center', overflow: 'hidden', marginHorizontal: spacing.lg, marginVertical: spacing.lg, borderRadius: radii.md},
  caption: {alignSelf: 'flex-start', color: colors.subtle, ...typography.caption, marginBottom: spacing.xs},
});
