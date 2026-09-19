import React, {useEffect, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {AppIcon} from '../../components/AppIcon';
import {AppButton} from '../../components/DesignSystem';
import {Screen} from '../../components/Screen';
import {colors, radii, spacing, typography} from '../../theme';
import {KnowledgeRail} from './KnowledgeRail';
import {useAuthStore} from '../../stores/auth';
import {recordQuizRoundCompletion, showQuizInterstitialIfDue} from '../../native/quiz-interstitial';

export function QuizResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {sessionId, mode, categoryName, totalQuestions, correctCount, rewardCoins} = route.params as {
    sessionId: string; mode: 'NORMAL' | 'WRONG_REVIEW'; categoryName: string; totalQuestions: number; correctCount: number; rewardCoins: string | number;
  };
  const userId = useAuthStore(state => state.user?.id);
  const [transitioning, setTransitioning] = useState(false);
  const completionRecord = useRef<Promise<void>>(Promise.resolve());
  const reviewing = mode === 'WRONG_REVIEW';
  const accuracy = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
  const message = accuracy >= 90 ? '知识轨道已全线点亮' : accuracy >= 70 ? '状态很好，再向前一步' : '每次作答都在积累新知';

  useEffect(() => {
    if (!reviewing && userId) {
      completionRecord.current = recordQuizRoundCompletion(userId, sessionId);
    }
  }, [reviewing, sessionId, userId]);

  const handlePrimaryAction = async () => {
    if (reviewing) {
      navigation.navigate('WrongQuestions');
      return;
    }
    if (transitioning) return;
    setTransitioning(true);
    try {
      await completionRecord.current;
      if (userId) await showQuizInterstitialIfDue(userId);
    } finally {
      navigation.popToTop();
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>CHALLENGE COMPLETE</Text>
          <Text style={styles.title}>{message}</Text>
          <Text style={styles.subtitle}>{categoryName} · 本局完成</Text>

          <View style={styles.scoreStage}>
            <View style={styles.scoreSticker}><AppIcon name="sparkles" color={colors.warning} size={18} /></View>
            <View style={styles.scoreHalo}>
              <Text style={styles.score}>{accuracy}</Text>
              <Text style={styles.percent}>%</Text>
            </View>
            <Text style={styles.scoreCaption}>正确率</Text>
          </View>
          <KnowledgeRail progress={1} />

          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{correctCount}/{totalQuestions}</Text><Text style={styles.metricLabel}>答对题数</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>{reviewing ? <><View style={styles.rewardValue}><AppIcon name="bookmark" color={colors.warning} size={19} /><Text style={[styles.metricValue, {color: colors.warning}]}>{totalQuestions - correctCount}</Text></View><Text style={styles.metricLabel}>仍需复习</Text></> : <><View style={styles.rewardValue}><AppIcon name="coins" color={colors.warning} size={19} /><Text style={[styles.metricValue, {color: colors.warning}]}>+{String(rewardCoins)}</Text></View><Text style={styles.metricLabel}>本局金币</Text></>}</View>
          </View>

          <View style={styles.note}><AppIcon name={reviewing ? 'bookmark' : 'sparkles'} color={colors.primary} size={19} /><Text style={styles.noteText}>{reviewing ? '专项复习不发放金币；本局答对的题目已自动移出错题本。' : '前 5 局完成挑战可获得金币，成绩已保存到最近答题。'}</Text></View>
        </View>
        <View style={styles.actions}>
          <AppButton title={reviewing ? '返回错题本' : '再来一局'} icon="refresh" loading={transitioning} disabled={transitioning} onPress={handlePrimaryAction} style={styles.button} />
          <AppButton title="返回答题首页" variant="secondary" disabled={transitioning} onPress={() => navigation.navigate('Main', {screen: '答题'})} style={styles.button} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {paddingTop: spacing.xxl, paddingBottom: spacing.lg},
  scrollContent: {flexGrow: 1},
  content: {flexGrow: 1},
  eyebrow: {color: colors.primary, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1.8, textAlign: 'center'},
  title: {color: colors.text, ...typography.title, textAlign: 'center', marginTop: spacing.sm},
  subtitle: {color: colors.muted, ...typography.body, textAlign: 'center', marginTop: spacing.xs},
  scoreStage: {alignItems: 'center', marginVertical: 38},
  scoreSticker: {position: 'absolute', zIndex: 2, right: '25%', top: -8, width: 42, height: 42, borderRadius: 14, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center', transform: [{rotate: '8deg'}]},
  scoreHalo: {width: 156, height: 156, borderRadius: 52, backgroundColor: colors.surface, borderWidth: 10, borderColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', transform: [{rotate: '-2deg'}]},
  score: {color: colors.text, fontSize: 54, lineHeight: 62, fontWeight: '900'},
  percent: {color: colors.primary, fontSize: 20, fontWeight: '800', alignSelf: 'center', marginTop: 22},
  scoreCaption: {color: colors.muted, ...typography.label, marginTop: spacing.md},
  metrics: {flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.lg, marginTop: spacing.xl},
  metric: {flex: 1, alignItems: 'center'},
  metricValue: {color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800'},
  metricLabel: {color: colors.muted, ...typography.caption, marginTop: 3},
  metricDivider: {width: 1, backgroundColor: colors.divider},
  rewardValue: {flexDirection: 'row', gap: 5, alignItems: 'center'},
  note: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, padding: spacing.md, borderRadius: radii.md, marginTop: spacing.lg},
  noteText: {color: colors.muted, ...typography.caption, flex: 1},
  actions: {gap: spacing.md, marginTop: spacing.xl},
  button: {minHeight: 52, borderRadius: radii.lg},
});
