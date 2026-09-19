import React from 'react';
import {adConfig} from '../config/ad-config';
import {TakuBannerAd} from './TakuBannerAd';

/** 平台无关的横幅入口；业务页面不直接依赖厂商组件。 */
export function AdBanner() {
  if (adConfig.provider === 'taku') return <TakuBannerAd />;
  return null;
}
