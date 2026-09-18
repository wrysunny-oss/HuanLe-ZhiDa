import {
  fonts,
  media,
  settings,
  shorthands,
  themes,
  tokens,
} from '@tamagui/config/v5';
import {createTamagui} from '@tamagui/core';
import {animations} from './motion';

/** 模板迁移基线的全局语义色。页面只能引用语义，不直接散落色值。 */
export const colors = {
  background: '#0B0A17',
  surface: '#151329',
  surfaceAlt: '#1D1A36',
  surfaceHighlight: '#282348',
  overlay: 'rgba(11, 10, 23, 0.76)',
  primary: '#8B7CFF',
  primaryPressed: '#7464EB',
  primarySoft: '#242044',
  onPrimary: '#FFFFFF',
  text: '#F7F5FF',
  muted: '#AAA5C2',
  subtle: '#77718F',
  success: '#52D6A4',
  successSoft: '#15372F',
  danger: '#FF7C91',
  dangerSoft: '#3A1D2B',
  warning: '#F5C96A',
  warningSoft: '#382F1B',
  border: '#312D4A',
  divider: '#25213C',
} as const;

/** 设计系统仅允许使用这六档间距。 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 控件、卡片和大容器分别使用 8/12/16/24 四档圆角。 */
export const radii = {sm: 8, md: 12, lg: 16, xl: 24} as const;

export const typography = {
  display: {fontSize: 30, lineHeight: 38, fontWeight: '800' as const},
  title: {fontSize: 24, lineHeight: 32, fontWeight: '700' as const},
  section: {fontSize: 18, lineHeight: 26, fontWeight: '700' as const},
  body: {fontSize: 15, lineHeight: 22, fontWeight: '400' as const},
  label: {fontSize: 13, lineHeight: 18, fontWeight: '600' as const},
  caption: {fontSize: 12, lineHeight: 17, fontWeight: '400' as const},
} as const;

export const layout = {
  pagePadding: spacing.lg,
  cardRadius: radii.lg,
  controlRadius: radii.md,
  sectionGap: spacing.xl,
} as const;

/** Tamagui 只负责运行时组件能力，色彩仍以本文件的语义变量为准。 */
export const tamaguiConfig = createTamagui({
  animations,
  fonts,
  media,
  settings,
  shorthands,
  tokens,
  themes: {
    ...themes,
    rewardApp: {
      ...themes.dark,
      background: colors.background,
      backgroundHover: colors.surface,
      backgroundPress: colors.surfaceAlt,
      backgroundFocus: colors.surface,
      color: colors.text,
      colorHover: colors.text,
      colorPress: colors.text,
      colorFocus: colors.text,
      borderColor: colors.border,
      borderColorHover: colors.primary,
      borderColorPress: colors.primaryPressed,
      borderColorFocus: colors.primary,
      shadowColor: '#000000',
    },
  },
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module '@tamagui/web' {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
