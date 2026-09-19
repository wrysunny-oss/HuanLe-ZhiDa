import React from 'react';
import {adConfig} from '../config/ad-config';
import {GroMoreFeedAd} from './GroMoreFeedAd';
import {TakuFeedAd} from './TakuFeedAd';

/** 平台无关的信息流广告入口；厂商组件不得泄漏到业务页面。 */
export function AdFeed() {
  if (adConfig.provider === 'gromore') return <GroMoreFeedAd />;
  if (adConfig.provider === 'taku') return <TakuFeedAd />;
  return null;
}
