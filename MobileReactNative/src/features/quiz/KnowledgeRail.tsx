import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, StyleSheet, View} from 'react-native';
import {colors} from '../../theme';

export function KnowledgeRail({progress}: {progress: number}) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(new Animated.Value(safeProgress)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      animatedProgress.setValue(safeProgress);
      return;
    }
    Animated.spring(animatedProgress, {
      toValue: safeProgress,
      damping: 18,
      stiffness: 160,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, reduceMotion, safeProgress]);

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{min: 0, max: 100, now: Math.round(safeProgress * 100)}} style={styles.track}>
      <Animated.View style={[styles.fill, {width: animatedProgress.interpolate({inputRange: [0, 1], outputRange: ['4%', '100%']})}]} />
      {[0, 0.25, 0.5, 0.75, 1].map(node => (
        <View key={node} style={[styles.node, {left: `${node * 100}%`}, node <= safeProgress && styles.nodeActive]}>
          {node <= safeProgress ? <View style={styles.nodeCore} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {height: 6, borderRadius: 3, backgroundColor: colors.surfaceHighlight, position: 'relative', marginHorizontal: 7},
  fill: {height: 6, borderRadius: 3, backgroundColor: colors.primary},
  node: {position: 'absolute', top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', transform: [{rotate: '45deg'}]},
  nodeActive: {backgroundColor: colors.primarySoft, borderColor: colors.primary},
  nodeCore: {width: 5, height: 5, borderRadius: 2, backgroundColor: colors.primary},
});
