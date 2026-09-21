import React from 'react';
import {StyleSheet, View, ViewProps} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout } from '../theme';
export function Screen({children, style, ...props}: ViewProps) {
  return (
    <SafeAreaView style={s.safe}>
      <View pointerEvents="none" style={s.decoration} accessibilityElementsHidden>
        <View style={s.dotLarge} />
        <View style={s.dotSmall} />
        <View style={s.dash} />
      </View>
      <View style={[s.body, style]} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background, overflow: 'hidden'},
  body: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: layout.pagePadding,
  },
  decoration: {...StyleSheet.absoluteFillObject},
  dotLarge: {position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -72, top: 74, backgroundColor: colors.secondarySoft, opacity: 0.58},
  dotSmall: {position: 'absolute', width: 44, height: 44, borderRadius: 15, left: -18, bottom: 116, backgroundColor: colors.primarySoft, transform: [{rotate: '18deg'}]},
  dash: {position: 'absolute', width: 58, height: 10, borderRadius: 5, right: 30, bottom: 148, backgroundColor: colors.accentSoft, transform: [{rotate: '-12deg'}]},
});
