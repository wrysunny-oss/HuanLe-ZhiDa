import {shouldShowQuizInterstitial, type QuizInterstitialState} from './quiz-interstitial';

const now = new Date('2026-09-19T10:00:00+08:00').getTime();
const state: QuizInterstitialState = {
  day: '2026-09-19',
  shownToday: 0,
  roundsSinceAttempt: 3,
  lastShownAt: 0,
  lastCompletedSessionId: 'session-3',
};
const policy = {
  dailyLimit: 5,
  minimumIntervalMinutes: 20,
  quizRoundInterval: 3,
  skipFirstQuizRound: true,
};

test('首局豁免，即使历史计数已达阈值也不展示', () => {
  expect(shouldShowQuizInterstitial(state, policy, 1, now)).toBe(false);
});

test('完成局数、时间间隔和每日上限同时满足时展示', () => {
  expect(shouldShowQuizInterstitial(state, policy, 3, now)).toBe(true);
});

test('未达到间隔局数时不展示', () => {
  expect(shouldShowQuizInterstitial({...state, roundsSinceAttempt: 2}, policy, 3, now)).toBe(false);
});

test('达到每日上限或最小时间间隔未满足时不展示', () => {
  expect(shouldShowQuizInterstitial({...state, shownToday: 5}, policy, 3, now)).toBe(false);
  expect(shouldShowQuizInterstitial({...state, lastShownAt: now - 19 * 60_000}, policy, 3, now)).toBe(false);
});
