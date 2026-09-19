import React, {useCallback, useState} from 'react';
import {FlatList, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {appApi} from '../../api/app';
import {useAppDialog} from '../../components/AppDialog';
import {AppIcon} from '../../components/AppIcon';
import {AppButton, EmptyState, SkeletonBlock} from '../../components/DesignSystem';
import {Screen} from '../../components/Screen';
import type {QuizSession, QuizWrongQuestion} from '../../types/api';
import {colors, radii, spacing, typography} from '../../theme';
import {createRequestId, readableError} from './quiz.utils';

const PAGE_SIZE = 20;

function answerText(item: QuizWrongQuestion, indexes: number[]) {
  return indexes
    .map(index => item.options[index])
    .filter((value): value is string => Boolean(value))
    .join('、');
}

function WrongQuestionCard({item}: {item: QuizWrongQuestion}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopline}>
        <View style={styles.categoryBadge}><Text style={styles.categoryText}>{item.categoryName}</Text></View>
        <Text style={styles.wrongCount}>答错 {item.wrongCount} 次</Text>
      </View>
      <Text style={styles.prompt}>{item.prompt}</Text>
      <View style={styles.answerBlock}>
        <View style={styles.answerRow}>
          <AppIcon name="x" color={colors.danger} size={16} />
          <Text style={styles.answerLabel}>你上次选：</Text>
          <Text style={styles.wrongAnswer}>{answerText(item, item.selectedIndexes) || '未记录'}</Text>
        </View>
        <View style={styles.answerRow}>
          <AppIcon name="check" color={colors.success} size={16} />
          <Text style={styles.answerLabel}>正确答案：</Text>
          <Text style={styles.correctAnswer}>{answerText(item, item.correctAnswerIndexes)}</Text>
        </View>
      </View>
      <Text style={styles.explanation}>{item.explanation || '暂无解析，先记住正确答案再继续练习。'}</Text>
      {!item.available ? <Text style={styles.unavailable}>题目目前已下线，暂不进入专项练习。</Text> : null}
    </View>
  );
}

function QuestionSeparator() {
  return <View style={styles.separator} />;
}

export function WrongQuestionsScreen() {
  const navigation = useNavigation<any>();
  const dialog = useAppDialog();
  const [items, setItems] = useState<QuizWrongQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [starting, setStarting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = 1, replace = true) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const result = await appApi.quizWrongQuestions(nextPage, PAGE_SIZE);
      setItems(current => replace ? result.list : [...current, ...result.list]);
      setTotal(result.total);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(readableError(loadError, '错题本加载失败，请稍后重试'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load().catch(() => undefined);
  };

  const startPractice = async () => {
    setStarting(true);
    setError('');
    try {
      const session: QuizSession = await appApi.startWrongQuestionPractice({
        requestId: createRequestId(),
        questionCount: Math.min(10, total),
      });
      navigation.navigate('QuizPlay', {session});
    } catch (startError) {
      setError(readableError(startError, '暂时无法开始错题复习'));
    } finally {
      setStarting(false);
    }
  };

  const clearAll = async () => {
    const confirmed = await dialog.confirm({
      title: '清空错题本',
      message: `将移除当前记录的 ${total} 道错题，历史答题成绩不会受到影响。`,
      confirmText: '清空错题',
      tone: 'danger',
    });
    if (!confirmed) return;
    setClearing(true);
    setError('');
    try {
      await appApi.clearQuizWrongQuestions();
      setItems([]);
      setTotal(0);
      setHasMore(false);
      await dialog.alert({title: '错题本已清空', message: '新的错题会在之后答错时自动加入。', tone: 'success'});
    } catch (clearError) {
      setError(readableError(clearError, '清空失败，请稍后重试'));
    } finally {
      setClearing(false);
    }
  };

  const header = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><AppIcon name="bookmark" color={colors.warning} size={25} /></View>
        <View style={styles.heroBody}>
          <Text style={styles.eyebrow}>REVIEW · AGAIN</Text>
          <Text style={styles.title}>把不会的，练成会的</Text>
          <Text style={styles.subtitle}>{total ? `已收集 ${total} 道错题，答对后会自动移出。` : '答错的题会自动来到这里。'}</Text>
        </View>
      </View>
      {total ? (
        <View style={styles.actions}>
          <AppButton title={`专项练习 ${Math.min(10, total)} 题`} icon="refresh" onPress={startPractice} loading={starting} style={styles.practiceButton} />
          <AppButton title="清空" variant="danger" onPress={clearAll} loading={clearing} style={styles.clearButton} />
        </View>
      ) : null}
      {error ? <View style={styles.errorBox}><AppIcon name="info" color={colors.danger} size={17} /><Text style={styles.errorText}>{error}</Text></View> : null}
      {total ? <View style={styles.sectionRow}><Text style={styles.sectionTitle}>待复习题目</Text><Text style={styles.sectionHint}>最近答错优先</Text></View> : null}
    </>
  );

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={({item}) => <WrongQuestionCard item={item} />}
        ItemSeparatorComponent={QuestionSeparator}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <View style={styles.skeletons}><SkeletonBlock style={styles.skeleton} /><SkeletonBlock style={styles.skeleton} /></View> : <EmptyState icon="bookmark" title={error ? '错题本暂时没有加载出来' : '错题本还是空的'} description={error || '完成答题后，答错的题会自动收进这里。'} action={error ? '重新加载' : undefined} onAction={error ? () => load() : undefined} />}
        ListFooterComponent={loadingMore ? <SkeletonBlock style={styles.footerSkeleton} /> : null}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReached={() => { if (hasMore && !loadingMore) load(page + 1, false).catch(() => undefined); }}
        onEndReachedThreshold={0.35}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {paddingHorizontal: 0},
  content: {paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl},
  hero: {flexDirection: 'row', gap: spacing.lg, alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radii.xl, padding: spacing.xl, transform: [{rotate: '-0.5deg'}]},
  heroIcon: {width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, transform: [{rotate: '4deg'}]},
  heroBody: {flex: 1},
  eyebrow: {color: colors.warning, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.4},
  title: {color: colors.text, fontSize: 21, lineHeight: 29, fontWeight: '800', marginTop: 3},
  subtitle: {color: colors.muted, ...typography.caption, marginTop: spacing.xs},
  actions: {flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg},
  practiceButton: {flex: 1},
  clearButton: {width: 92},
  errorBox: {flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg},
  errorText: {color: colors.danger, ...typography.caption, flex: 1},
  sectionRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.md},
  sectionTitle: {color: colors.text, ...typography.section},
  sectionHint: {color: colors.muted, ...typography.caption},
  card: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg},
  cardTopline: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md},
  categoryBadge: {backgroundColor: colors.secondarySoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4},
  categoryText: {color: colors.secondary, ...typography.caption, fontWeight: '700'},
  wrongCount: {color: colors.danger, ...typography.caption},
  prompt: {color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: '700', marginTop: spacing.md},
  answerBlock: {gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider},
  answerRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 6},
  answerLabel: {color: colors.muted, ...typography.caption},
  wrongAnswer: {color: colors.danger, ...typography.caption, fontWeight: '700', flex: 1},
  correctAnswer: {color: colors.success, ...typography.caption, fontWeight: '700', flex: 1},
  explanation: {color: colors.muted, ...typography.body, marginTop: spacing.md},
  unavailable: {color: colors.warning, ...typography.caption, marginTop: spacing.md},
  separator: {height: spacing.md},
  skeletons: {gap: spacing.md, marginTop: spacing.xl},
  skeleton: {height: 190},
  footerSkeleton: {height: 72, marginTop: spacing.md},
});
