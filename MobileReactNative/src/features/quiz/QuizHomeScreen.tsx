import React, {useCallback, useEffect, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {appApi} from '../../api/app';
import {AppIcon} from '../../components/AppIcon';
import {AppButton, EmptyState, SkeletonBlock} from '../../components/DesignSystem';
import {Screen} from '../../components/Screen';
import type {QuizCategory, QuizHistory, QuizSession} from '../../types/api';
import {colors, radii, spacing, typography} from '../../theme';
import {MotionPressable} from '../../components/MotionPressable';
import {KnowledgeRail} from './KnowledgeRail';
import {createRequestId, quizCategoryPresentation, readableError, type QuizCategoryTone} from './quiz.utils';

const categoryTones: Record<QuizCategoryTone, {activeCard: ViewStyle; inactiveCard: ViewStyle; text: TextStyle & {color: string}}> = {
  accent: StyleSheet.create({activeCard: {backgroundColor: colors.accent, borderColor: colors.accent}, inactiveCard: {backgroundColor: colors.accentSoft, borderColor: colors.accentSoft}, text: {color: colors.accent}}),
  primary: StyleSheet.create({activeCard: {backgroundColor: colors.primary, borderColor: colors.primary}, inactiveCard: {backgroundColor: colors.primarySoft, borderColor: colors.primarySoft}, text: {color: colors.primary}}),
  secondary: StyleSheet.create({activeCard: {backgroundColor: colors.secondary, borderColor: colors.secondary}, inactiveCard: {backgroundColor: colors.secondarySoft, borderColor: colors.secondarySoft}, text: {color: colors.secondary}}),
  warning: StyleSheet.create({activeCard: {backgroundColor: colors.warning, borderColor: colors.warning}, inactiveCard: {backgroundColor: colors.warningSoft, borderColor: colors.warningSoft}, text: {color: colors.warning}}),
};

export function QuizHomeScreen() {
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | number>();
  const [history, setHistory] = useState<QuizHistory>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const [categoryResult, historyResult] = await Promise.all([
        appApi.quizCategories(),
        appApi.quizHistory(1, 5),
      ]);
      setCategories(categoryResult);
      setSelectedId(current => current ?? categoryResult[0]?.id);
      setHistory(historyResult);
    } catch (loadError) {
      setError(readableError(loadError, '加载答题数据失败，请稍后重试'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    if (!selectedId) return;
    setStarting(true);
    setError('');
    try {
      const session: QuizSession = await appApi.startQuizSession({
        requestId: createRequestId(),
        categoryId: selectedId,
        questionCount: 10,
      });
      navigation.navigate('QuizPlay', {session});
    } catch (startError) {
      setError(readableError(startError, '暂时无法开始挑战'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.eyebrow}>HUANLE · QUIZ</Text>
            <Text style={styles.title}>今天，点亮一点新知</Text>
          </View>
          <View style={styles.brandMark}><AppIcon name="book-open" color={colors.primary} size={24} /></View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroSticker}><AppIcon name="sparkles" color={colors.secondary} size={14} /><Text style={styles.heroStickerText}>今天也涨知识</Text></View>
          <View style={styles.heroHeading}>
            <View>
              <Text style={styles.heroLabel}>每日知识挑战</Text>
              <Text style={styles.heroTitle}>10 题 · 约 3 分钟</Text>
            </View>
            <View style={styles.rewardBadge}><AppIcon name="coins" color={colors.warning} size={16} /><Text style={styles.rewardText}>完成 +10</Text></View>
          </View>
          <Text style={styles.heroDescription}>沿着知识轨道完成一局。每道题提交后即可查看答案与解析。</Text>
          <KnowledgeRail progress={0.25} />
          <View style={styles.railLabels}><Text style={styles.railText}>起点</Text><Text style={styles.railText}>今日目标</Text></View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>选择题目方向</Text>
          <Text style={styles.sectionHint}>单选题</Text>
        </View>
        {loading ? (
          <View style={styles.categoryGrid}><SkeletonBlock style={styles.categorySkeleton} /><SkeletonBlock style={styles.categorySkeleton} /></View>
        ) : categories.length ? (
          <View style={styles.categoryGrid}>
            {categories.map((category, index) => {
              const active = selectedId === category.id;
              const presentation = quizCategoryPresentation(category.code, index);
              const tone = categoryTones[presentation.tone];
              return (
                <MotionPressable
                  key={String(category.id)}
                  accessibilityHint={`选择后可开始${category.name}挑战`}
                  accessibilityLabel={`${category.name}，${category.questionCount} 道可用`}
                  accessibilityRole="button"
                  accessibilityState={{selected: active}}
                  feedback="button"
                  onPress={() => setSelectedId(category.id)}
                  style={[
                    styles.category,
                    active ? tone.activeCard : tone.inactiveCard,
                  ]}>
                  <View style={styles.categoryTopline}>
                    <View style={[styles.categoryIcon, active ? styles.categoryIconActive : styles.categoryIconInactive]}>
                      <AppIcon name={presentation.icon} color={active ? colors.onPrimary : tone.text.color} size={20} />
                    </View>
                    <Text style={[styles.categoryKicker, active ? styles.categoryKickerActive : tone.text]}>{presentation.kicker}</Text>
                  </View>
                  <Text style={[styles.categoryName, active && styles.categoryNameActive]}>{category.name}</Text>
                  <Text style={[styles.categoryCount, active && styles.categoryCountActive]}>{category.questionCount} 道可用</Text>
                </MotionPressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="book-open" title="题目正在准备中" description="请先在管理后台审核并发布题目。" action="重新加载" onAction={() => load()} />
        )}

        {error ? <View style={styles.errorBox}><AppIcon name="info" color={colors.danger} size={18} /><Text style={styles.errorText}>{error}</Text></View> : null}
        <AppButton title="开始今日挑战" icon="play" onPress={start} loading={starting} disabled={!selectedId || loading} style={styles.startButton} />

        <View style={[styles.sectionRow, styles.historyHeading]}>
          <Text style={styles.sectionTitle}>最近答题</Text>
          <Text style={styles.sectionHint}>{history?.total ?? 0} 局</Text>
        </View>
        {history?.list.length ? history.list.map(item => {
          const accuracy = Math.round((item.correctCount / Math.max(1, item.totalQuestions)) * 100);
          return (
            <View key={item.id} style={styles.historyRow}>
              <View style={styles.scoreRing}><Text style={styles.scoreValue}>{accuracy}</Text><Text style={styles.scoreUnit}>%</Text></View>
              <View style={styles.historyBody}>
                <Text style={styles.historyTitle}>{item.category?.name ?? '综合挑战'}</Text>
                <Text style={styles.historyMeta}>{item.correctCount}/{item.totalQuestions} 正确 · {new Date(item.completedAt).toLocaleDateString('zh-CN')}</Text>
              </View>
              <Text style={styles.coinText}>+{String(item.rewardCoins)}</Text>
            </View>
          );
        }) : !loading ? <Text style={styles.emptyHistory}>完成第一局后，成绩会记录在这里。</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {paddingHorizontal: 0},
  content: {paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 36},
  topbar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl},
  eyebrow: {color: colors.primary, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1.8},
  title: {color: colors.text, fontSize: 25, lineHeight: 34, fontWeight: '800', marginTop: 4},
  brandMark: {width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, transform: [{rotate: '4deg'}]},
  hero: {backgroundColor: colors.secondarySoft, borderWidth: 1, borderColor: colors.secondarySoft, borderRadius: radii.xl, padding: spacing.xl, paddingTop: 42, transform: [{rotate: '-0.5deg'}]},
  heroSticker: {position: 'absolute', top: -11, left: spacing.lg, minHeight: 30, borderRadius: 10, backgroundColor: colors.warningSoft, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, transform: [{rotate: '2deg'}]},
  heroStickerText: {color: colors.text, ...typography.caption, fontWeight: '700'},
  heroHeading: {flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md},
  heroLabel: {color: colors.muted, ...typography.label},
  heroTitle: {color: colors.text, fontSize: 25, lineHeight: 34, fontWeight: '800', marginTop: 3},
  rewardBadge: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.warningSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7},
  rewardText: {color: colors.warning, fontSize: 12, fontWeight: '700'},
  heroDescription: {color: colors.muted, ...typography.body, marginTop: spacing.lg, marginBottom: spacing.xl},
  railLabels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 10},
  railText: {color: colors.subtle, ...typography.caption},
  sectionRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md},
  sectionTitle: {color: colors.text, ...typography.section},
  sectionHint: {color: colors.muted, ...typography.caption},
  categoryGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md},
  categorySkeleton: {height: 104, flexBasis: '47%', flexGrow: 1},
  category: {minHeight: 128, flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg},
  categoryTopline: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm},
  categoryIcon: {width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  categoryIconActive: {backgroundColor: 'rgba(255,255,255,0.16)'},
  categoryIconInactive: {backgroundColor: colors.surface},
  categoryKicker: {fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.8},
  categoryKickerActive: {color: 'rgba(255,255,255,0.78)'},
  categoryName: {color: colors.text, ...typography.label, fontSize: 15, marginTop: spacing.md},
  categoryNameActive: {color: colors.onPrimary},
  categoryCount: {color: colors.muted, ...typography.caption, marginTop: 2},
  categoryCountActive: {color: 'rgba(255,255,255,0.72)'},
  errorBox: {flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.lg, backgroundColor: colors.dangerSoft, borderRadius: radii.md, padding: spacing.md},
  errorText: {color: colors.danger, ...typography.caption, flex: 1},
  startButton: {marginTop: spacing.lg, minHeight: 54, borderRadius: radii.lg},
  historyHeading: {marginTop: spacing.xxl},
  historyRow: {minHeight: 72, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.md},
  scoreRing: {width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row'},
  scoreValue: {color: colors.text, fontSize: 14, fontWeight: '800'},
  scoreUnit: {color: colors.muted, fontSize: 9, marginTop: 3},
  historyBody: {flex: 1, marginLeft: spacing.md},
  historyTitle: {color: colors.text, ...typography.label},
  historyMeta: {color: colors.muted, ...typography.caption, marginTop: 3},
  coinText: {color: colors.warning, ...typography.label},
  emptyHistory: {color: colors.muted, ...typography.body, paddingVertical: spacing.xl},
});
