import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {appApi} from '../../api/app';
import {AppIcon} from '../../components/AppIcon';
import {AppButton} from '../../components/DesignSystem';
import {MotionPressable} from '../../components/MotionPressable';
import {Screen} from '../../components/Screen';
import {colors, radii, spacing, typography} from '../../theme';
import type {QuizAnswerResult, QuizQuestion, QuizSession} from '../../types/api';
import {KnowledgeRail} from './KnowledgeRail';
import {readableError} from './quiz.utils';

export function QuizPlayScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params.session as QuizSession;
  const [question, setQuestion] = useState<QuizQuestion | null>(session.question);
  const [selected, setSelected] = useState<number>();
  const [result, setResult] = useState<QuizAnswerResult>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!question) return null;
  const progress = result ? result.answeredCount / session.totalQuestions : (question.position - 1) / session.totalQuestions;

  const submit = async () => {
    if (selected === undefined) return;
    setSubmitting(true);
    setError('');
    try {
      const answer = await appApi.submitQuizAnswer(session.id, {position: question.position, selectedIndexes: [selected]});
      setResult(answer);
    } catch (submitError) {
      setError(readableError(submitError, '答案提交失败，请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const continueQuiz = () => {
    if (!result) return;
    if (result.completed) {
      navigation.replace('QuizResult', {
        sessionId: session.id,
        categoryName: session.categoryName,
        totalQuestions: session.totalQuestions,
        correctCount: result.correctCount,
        rewardCoins: result.rewardCoins,
      });
      return;
    }
    setQuestion(result.nextQuestion);
    setSelected(undefined);
    setResult(undefined);
    setError('');
  };

  const optionState = (index: number): OptionState => {
    if (!result) return selected === index ? 'selected' : 'idle';
    if (result.correctAnswerIndexes.includes(index)) return 'correct';
    if (result.selectedIndexes.includes(index)) return 'wrong';
    return 'disabled';
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.category}>{session.categoryName}</Text>
          <Text style={styles.counter}>{question.position}<Text style={styles.counterMuted}> / {session.totalQuestions}</Text></Text>
        </View>
        <KnowledgeRail progress={progress} />
        <Text style={styles.prompt}>{question.prompt}</Text>
        <Text style={styles.helper}>选择你认为正确的一项</Text>

        <View style={styles.options}>
          {question.options.map((option, index) => {
            const state = optionState(index);
            return (
              <MotionPressable
                key={`${question.position}-${index}`}
                feedback="listRow"
                disabled={Boolean(result)}
                onPress={() => setSelected(index)}
                style={[styles.option, styles[`option_${state}`]]}>
                <View style={[styles.optionIndex, styles[`optionIndex_${state}`]]}>
                  {state === 'correct' ? <AppIcon name="check" color={colors.success} size={18} /> : state === 'wrong' ? <AppIcon name="x" color={colors.danger} size={18} /> : <Text style={[styles.optionIndexText, state === 'selected' && styles.optionIndexTextSelected]}>{String.fromCharCode(65 + index)}</Text>}
                </View>
                <Text style={[styles.optionText, state === 'disabled' && styles.optionTextDisabled]}>{option}</Text>
              </MotionPressable>
            );
          })}
        </View>

        {result ? (
          <View style={[styles.feedback, result.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <View style={styles.feedbackTitleRow}>
              <AppIcon name={result.correct ? 'check' : 'x'} color={result.correct ? colors.success : colors.danger} size={20} />
              <Text style={[styles.feedbackTitle, {color: result.correct ? colors.success : colors.danger}]}>{result.correct ? '回答正确' : '这题答错了'}</Text>
            </View>
            <Text style={styles.feedbackBody}>{result.explanation || '答案已经揭晓，记住这个知识点继续前进吧。'}</Text>
          </View>
        ) : <View style={styles.feedbackPlaceholder} />}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <AppButton
          title={result ? (result.completed ? '查看本局成绩' : '下一题') : '确认答案'}
          onPress={result ? continueQuiz : submit}
          loading={submitting}
          disabled={!result && selected === undefined}
          style={styles.primaryButton}
        />
      </View>
    </Screen>
  );
}

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';
const styles = StyleSheet.create({
  screen: {paddingHorizontal: 0},
  content: {paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120},
  metaRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg},
  category: {color: colors.primary, ...typography.label},
  counter: {color: colors.text, fontSize: 17, fontWeight: '800'},
  counterMuted: {color: colors.subtle, fontSize: 13, fontWeight: '500'},
  prompt: {color: colors.text, fontSize: 25, lineHeight: 36, fontWeight: '800', marginTop: 42},
  helper: {color: colors.muted, ...typography.body, marginTop: spacing.sm},
  options: {gap: spacing.md, marginTop: spacing.xl},
  option: {minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  option_idle: {},
  option_selected: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  option_correct: {borderColor: colors.success, backgroundColor: colors.successSoft},
  option_wrong: {borderColor: colors.danger, backgroundColor: colors.dangerSoft},
  option_disabled: {opacity: 0.62},
  optionIndex: {width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center'},
  optionIndex_idle: {},
  optionIndex_selected: {backgroundColor: colors.primary},
  optionIndex_correct: {backgroundColor: colors.successSoft},
  optionIndex_wrong: {backgroundColor: colors.dangerSoft},
  optionIndex_disabled: {},
  optionIndexText: {color: colors.muted, fontSize: 13, fontWeight: '800'},
  optionIndexTextSelected: {color: colors.onPrimary},
  optionText: {color: colors.text, ...typography.body, fontWeight: '600', flex: 1},
  optionTextDisabled: {color: colors.muted},
  feedback: {marginTop: spacing.xl, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1},
  feedbackCorrect: {backgroundColor: colors.successSoft, borderColor: colors.success},
  feedbackWrong: {backgroundColor: colors.dangerSoft, borderColor: colors.danger},
  feedbackTitleRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  feedbackTitle: {...typography.label, fontSize: 15},
  feedbackBody: {color: colors.text, ...typography.body, marginTop: spacing.sm},
  feedbackPlaceholder: {height: 1, marginTop: spacing.xl},
  errorText: {color: colors.danger, ...typography.caption, marginTop: spacing.md},
  footer: {position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.divider},
  primaryButton: {minHeight: 54, borderRadius: radii.lg},
});
