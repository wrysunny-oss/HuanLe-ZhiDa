import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {
  ATBannerView,
  ATBannerViewComponent,
  BannerCallback,
} from '@taku_anythink/react-native-sdk';
import {adConfig} from '../config/ad-config';
import {colors, radii, spacing, typography} from '../theme';
import {getAdRuntimeConfig} from '../native/ad-runtime';
import {reportAdEvent} from '../native/ad-telemetry';
import {reportTakuRevenue, takuAdProvider} from '../native/taku';

const HEIGHT = 50;

/** 可复用的 Taku 横幅组件；当前页面未投放时不会自行占位。 */
export function TakuBannerAd() {
  const {width: windowWidth} = useWindowDimensions();
  const [hidden, setHidden] = useState(false);
  const controller = useRef<ATBannerView | undefined>(undefined);
  const runtime = getAdRuntimeConfig();
  const placementId = adConfig.banner.placementId;
  const width = Math.min(windowWidth - spacing.lg * 2, 420);

  useEffect(() => {
    if (!runtime.enabled || !runtime.banner.enabled || !placementId) return;
    const banner = new ATBannerView();
    controller.current = banner;
    takuAdProvider.initialize().then(() => {
      banner.setPlacementId(placementId);
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
  }, [placementId, runtime.banner.enabled, runtime.enabled, width]);

  if (hidden || !runtime.enabled || !runtime.banner.enabled || !placementId) return null;
  return (
    <View style={styles.wrapper}>
      <Text style={styles.caption}>广告</Text>
      <ATBannerViewComponent
        placementID={placementId}
        width={width}
        height={HEIGHT}
        style={{width, height: HEIGHT}}
        onAdEvent={event => {
          if (event.callbackName === BannerCallback.loaded) reportAdEvent({format: 'BANNER', eventType: 'LOADED', placementId});
          else if (event.callbackName === BannerCallback.show) reportAdEvent({format: 'BANNER', eventType: 'SHOW', placementId});
          else if (event.callbackName === BannerCallback.click) reportAdEvent({format: 'BANNER', eventType: 'CLICK', placementId});
          else if (event.callbackName === BannerCallback.close) {
            reportAdEvent({format: 'BANNER', eventType: 'CLOSE', placementId});
            setHidden(true);
          }
          else if (event.callbackName === BannerCallback.loadFail) {
            reportAdEvent({format: 'BANNER', eventType: 'FAIL', placementId, errorMessage: event.requestMessage});
            setHidden(true);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {alignItems: 'center', alignSelf: 'center', overflow: 'hidden', marginHorizontal: spacing.lg, marginVertical: spacing.lg, borderRadius: radii.md},
  caption: {alignSelf: 'flex-start', color: colors.subtle, ...typography.caption, marginBottom: spacing.xs},
});
