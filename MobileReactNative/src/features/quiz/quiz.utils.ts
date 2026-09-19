import type {AppIconName} from '../../components/AppIcon';
import type {QuizAnswerResult} from '../../types/api';

export type QuizOptionVisualState = 'idle' | 'pressed' | 'selected' | 'correct' | 'wrong' | 'disabled';

export function quizOptionVisualState(
  index: number,
  selected: number | undefined,
  pressed: number | undefined,
  result?: Pick<QuizAnswerResult, 'correctAnswerIndexes' | 'selectedIndexes'>,
): QuizOptionVisualState {
  if (result) {
    if (result.correctAnswerIndexes.includes(index)) return 'correct';
    if (result.selectedIndexes.includes(index)) return 'wrong';
    return 'disabled';
  }
  if (pressed === index) return 'pressed';
  return selected === index ? 'selected' : 'idle';
}

export type QuizCategoryTone = 'accent' | 'primary' | 'secondary' | 'warning';

export interface QuizCategoryPresentation {
  icon: AppIconName;
  kicker: string;
  tone: QuizCategoryTone;
}

const categoryPresentations: Record<string, QuizCategoryPresentation> = {
  'china-geography': {icon: 'map', kicker: '山河坐标', tone: 'secondary'},
  'chinese-idiom': {icon: 'message-circle', kicker: '字里乾坤', tone: 'warning'},
  'classical-poetry': {icon: 'book-open', kicker: '诗意挑战', tone: 'primary'},
};

const fallbackPresentations: QuizCategoryPresentation[] = [
  {icon: 'sparkles', kicker: '知识挑战', tone: 'accent'},
  {icon: 'book-open', kicker: '趣味问答', tone: 'warning'},
];

export function quizCategoryPresentation(code: string, index = 0) {
  return categoryPresentations[code]
    ?? fallbackPresentations[index % fallbackPresentations.length]!;
}

export function createRequestId() {
  const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return hex.replace(/[xy]/g, token => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : [8, 9, 10, 11][random % 4];
    return value.toString(16);
  });
}

export function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
