import React, {ReactNode, useEffect} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {AppIcon, AppIconName} from './AppIcon';
import {colors, radii, spacing, typography} from '../theme';
import {MotionPressable} from './MotionPressable';

const skeletonOpacity = new Animated.Value(1);
let skeletonAnimation: Animated.CompositeAnimation | undefined;
let skeletonUsers = 0;

function acquireSkeletonAnimation() {
  skeletonUsers += 1;
  if (skeletonUsers > 1) return;
  skeletonOpacity.setValue(1);
  skeletonAnimation = Animated.loop(
    Animated.sequence([
      Animated.timing(skeletonOpacity, {toValue: 0.48, duration: 850, useNativeDriver: true}),
      Animated.timing(skeletonOpacity, {toValue: 1, duration: 850, useNativeDriver: true}),
    ]),
  );
  skeletonAnimation.start();
}

function releaseSkeletonAnimation() {
  skeletonUsers = Math.max(0, skeletonUsers - 1);
  if (skeletonUsers !== 0) return;
  skeletonAnimation?.stop();
  skeletonAnimation = undefined;
  skeletonOpacity.setValue(1);
}

/** 统一卡片容器：同一层级共享背景、描边、圆角和内边距。 */
export function AppCard({
  children,
  style,
  elevated = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}) {
  return <View style={[styles.card, elevated && styles.elevated, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {action ? (
        <Pressable hitSlop={10} onPress={onAction} style={({pressed}) => pressed && styles.pressed}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconTile({
  name,
  color = colors.primary,
  size = 44,
}: {
  name: AppIconName;
  color?: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconTile, {width: size, height: size, borderRadius: Math.min(14, size / 3)}]}>
      <AppIcon name={name} color={color} size={Math.round(size * 0.48)} />
    </View>
  );
}

export function AppButton({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  icon?: AppIconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const foreground = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text;
  return (
    <MotionPressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      feedback="button"
      style={[
        styles.button,
        styles[`button_${variant}`],
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {icon ? <AppIcon name={icon} color={foreground} size={17} /> : null}
          <Text style={[styles.buttonText, {color: foreground}]}>{title}</Text>
        </>
      )}
    </MotionPressable>
  );
}

export function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, accent && {color: colors.primary}]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function AppListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  danger = false,
}: {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <MotionPressable
      onPress={onPress}
      disabled={!onPress}
      feedback="listRow"
      style={styles.listRow}>
      <IconTile name={icon} color={danger ? colors.danger : colors.primary} size={40} />
      <View style={styles.listBody}>
        <Text style={[styles.listTitle, danger && {color: colors.danger}]}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.listValue}>{value}</Text> : null}
      {onPress ? <AppIcon name="chevron-right" color={colors.subtle} size={18} /> : null}
    </MotionPressable>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
  icon = 'film',
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  icon?: AppIconName;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <AppIcon name={icon} color={colors.muted} size={30} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action ? (
        <AppButton title={action} icon="refresh" variant="secondary" onPress={onAction} style={styles.emptyButton} />
      ) : null}
    </View>
  );
}

export function SkeletonBlock({style}: {style?: StyleProp<ViewStyle>}) {
  useEffect(() => {
    acquireSkeletonAnimation();
    return releaseSkeletonAnimation;
  }, []);
  return (
    <Animated.View style={[styles.skeleton, style, {opacity: skeletonOpacity}]} />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  elevated: {
    shadowColor: colors.secondary,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionHeader: {flexDirection: 'row', alignItems: 'center'},
  sectionText: {flex: 1},
  sectionTitle: {color: colors.text, ...typography.section},
  sectionDescription: {color: colors.muted, ...typography.caption, marginTop: spacing.xs},
  sectionAction: {color: colors.primary, ...typography.label},
  pressed: {opacity: 0.65},
  iconTile: {backgroundColor: colors.secondarySoft, alignItems: 'center', justifyContent: 'center', transform: [{rotate: '-2deg'}]},
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  button_primary: {backgroundColor: colors.primary, borderColor: colors.primary},
  button_secondary: {backgroundColor: colors.surface, borderColor: colors.border},
  button_danger: {backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft},
  button_ghost: {backgroundColor: 'transparent', borderColor: 'transparent'},
  buttonText: {...typography.label, fontSize: 14},
  disabled: {opacity: 0.5},
  metric: {flex: 1, minWidth: 0, alignItems: 'center'},
  metricValue: {color: colors.text, fontSize: 19, lineHeight: 26, fontWeight: '700'},
  metricLabel: {color: colors.muted, ...typography.caption, marginTop: spacing.xs},
  listRow: {minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md},
  listBody: {flex: 1, marginLeft: spacing.md},
  listTitle: {color: colors.text, ...typography.body, fontWeight: '600'},
  listSubtitle: {color: colors.muted, ...typography.caption, marginTop: 2},
  listValue: {color: colors.muted, ...typography.caption, marginRight: spacing.sm},
  empty: {alignItems: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl},
  emptyIcon: {width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center'},
  emptyTitle: {color: colors.text, ...typography.section, marginTop: spacing.lg},
  emptyDescription: {color: colors.muted, ...typography.body, textAlign: 'center', marginTop: spacing.sm},
  emptyButton: {marginTop: spacing.lg, minWidth: 128},
  skeleton: {backgroundColor: colors.surfaceHighlight, borderRadius: radii.md, overflow: 'hidden'},
});
