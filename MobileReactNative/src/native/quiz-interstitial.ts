import AsyncStorage from '@react-native-async-storage/async-storage';
import {adProvider} from './ad-provider';
import {getAdRuntimeConfig} from './ad-runtime';

const STORAGE_PREFIX = 'hly_quiz_interstitial_v1';

export interface QuizInterstitialState {
  day: string;
  shownToday: number;
  roundsSinceAttempt: number;
  lastShownAt: number;
  lastCompletedSessionId: string;
}

export interface QuizInterstitialPolicy {
  dailyLimit: number;
  minimumIntervalMinutes: number;
  quizRoundInterval: number;
  skipFirstQuizRound: boolean;
}

const completedRoundsThisLaunch = new Map<string, number>();
let showPromise: Promise<boolean> | undefined;

function localDay(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyState(now: number): QuizInterstitialState {
  return {
    day: localDay(now),
    shownToday: 0,
    roundsSinceAttempt: 0,
    lastShownAt: 0,
    lastCompletedSessionId: '',
  };
}

function normalizeState(value: unknown, now: number): QuizInterstitialState {
  const fallback = emptyState(now);
  if (!value || typeof value !== 'object') return fallback;
  const state = value as Partial<QuizInterstitialState>;
  return {
    day: typeof state.day === 'string' ? state.day : fallback.day,
    shownToday: Number.isFinite(state.shownToday) ? Number(state.shownToday) : 0,
    roundsSinceAttempt: Number.isFinite(state.roundsSinceAttempt) ? Number(state.roundsSinceAttempt) : 0,
    lastShownAt: Number.isFinite(state.lastShownAt) ? Number(state.lastShownAt) : 0,
    lastCompletedSessionId: typeof state.lastCompletedSessionId === 'string' ? state.lastCompletedSessionId : '',
  };
}

function resetDailyCounter(state: QuizInterstitialState, now: number) {
  const today = localDay(now);
  return state.day === today ? state : {...state, day: today, shownToday: 0};
}

async function readState(userId: string, now: number) {
  const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
  return resetDailyCounter(normalizeState(raw ? JSON.parse(raw) : undefined, now), now);
}

function writeState(userId: string, state: QuizInterstitialState) {
  return AsyncStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify(state));
}

export function shouldShowQuizInterstitial(
  state: QuizInterstitialState,
  policy: QuizInterstitialPolicy,
  completedThisLaunch: number,
  now: number,
) {
  if (policy.skipFirstQuizRound && completedThisLaunch <= 1) return false;
  if (state.roundsSinceAttempt < policy.quizRoundInterval) return false;
  if (state.shownToday >= policy.dailyLimit) return false;
  return now - state.lastShownAt >= policy.minimumIntervalMinutes * 60_000;
}

/** A completed normal quiz is counted once by its server session id. */
export async function recordQuizRoundCompletion(userId: string, sessionId: string) {
  const runtime = getAdRuntimeConfig();
  if (!runtime.enabled || !runtime.fullScreen.enabled || !sessionId) return;
  try {
    const now = Date.now();
    const state = await readState(userId, now);
    if (state.lastCompletedSessionId === sessionId) return;
    await writeState(userId, {
      ...state,
      roundsSinceAttempt: state.roundsSinceAttempt + 1,
      lastCompletedSessionId: sessionId,
    });
    completedRoundsThisLaunch.set(userId, (completedRoundsThisLaunch.get(userId) ?? 0) + 1);
  } catch {
    // Frequency storage is a UX safeguard. If unavailable, fail closed and do not show an ad.
  }
}

/** Shows only when frequency rules allow it. Failure and no-fill always release the quiz transition. */
export function showQuizInterstitialIfDue(userId: string) {
  if (showPromise) return showPromise;
  showPromise = (async () => {
    const runtime = getAdRuntimeConfig();
    if (!runtime.enabled || !runtime.fullScreen.enabled) return false;
    try {
      const now = Date.now();
      const state = await readState(userId, now);
      if (!shouldShowQuizInterstitial(
        state,
        runtime.fullScreen,
        completedRoundsThisLaunch.get(userId) ?? 0,
        now,
      )) return false;

      const attemptedState = {...state, roundsSinceAttempt: 0};
      await writeState(userId, attemptedState);
      const shown = await adProvider.showFullScreen();
      if (shown) {
        await writeState(userId, {
          ...attemptedState,
          shownToday: attemptedState.shownToday + 1,
          lastShownAt: Date.now(),
        });
      }
      return shown;
    } catch {
      return false;
    }
  })().finally(() => {
    showPromise = undefined;
  });
  return showPromise;
}
