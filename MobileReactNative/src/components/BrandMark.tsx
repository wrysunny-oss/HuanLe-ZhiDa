import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

import {colors} from '../theme';

/**
 * APP 内统一品牌标识。
 * “打开的知识卡片”品牌标识，避免继续沿用旧剧场项目的播放键语义。
 */
export function BrandMark({
  size = 44,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{width: size, height: size}, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x="2" y="2" width="60" height="60" rx="20" fill={colors.primarySoft} />
        <Rect x="10" y="10" width="44" height="44" rx="15" fill={colors.primary} />
        <Path d="M18 22.5c5.7-1.4 10.3-.3 14 3.2v18c-3.7-3.5-8.3-4.6-14-3.2v-18Zm28 0c-5.7-1.4-10.3-.3-14 3.2v18c3.7-3.5 8.3-4.6 14-3.2v-18Z" fill="#FFFFFF" />
        <Path d="M32 25.7v18" stroke={colors.primarySoft} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="49" cy="17" r="5" fill={colors.playful} />
      </Svg>
    </View>
  );
}
