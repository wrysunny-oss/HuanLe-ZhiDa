import React from 'react';
import {StyleSheet, View} from 'react-native';
import {colors} from '../../theme';

export function KnowledgeRail({progress}: {progress: number}) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{min: 0, max: 100, now: Math.round(safeProgress * 100)}} style={styles.track}>
      <View style={[styles.fill, {width: `${Math.max(4, safeProgress * 100)}%`}]} />
      {[0, 0.25, 0.5, 0.75, 1].map(node => (
        <View key={node} style={[styles.node, {left: `${node * 100}%`}, node <= safeProgress && styles.nodeActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {height: 4, borderRadius: 2, backgroundColor: colors.surfaceHighlight, position: 'relative', marginHorizontal: 5},
  fill: {height: 4, borderRadius: 2, backgroundColor: colors.primary},
  node: {position: 'absolute', top: -3, width: 10, height: 10, marginLeft: -5, borderRadius: 5, backgroundColor: colors.surfaceHighlight, borderWidth: 2, borderColor: colors.surface},
  nodeActive: {backgroundColor: colors.primary, borderColor: colors.primarySoft},
});
