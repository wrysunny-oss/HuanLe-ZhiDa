import {quizCategoryPresentation, quizOptionVisualState} from './quiz.utils';

describe('quiz option visual state', () => {
  it('highlights an option immediately while the finger is down', () => {
    expect(quizOptionVisualState(1, undefined, 1)).toBe('pressed');
  });

  it('restores the committed selection when a press is cancelled', () => {
    expect(quizOptionVisualState(0, 0, undefined)).toBe('selected');
    expect(quizOptionVisualState(1, 0, undefined)).toBe('idle');
  });

  it('prioritizes the submitted result over transient touch state', () => {
    const result = {correctAnswerIndexes: [2], selectedIndexes: [1]};
    expect(quizOptionVisualState(2, 1, 2, result)).toBe('correct');
    expect(quizOptionVisualState(1, 1, 1, result)).toBe('wrong');
    expect(quizOptionVisualState(0, 1, 0, result)).toBe('disabled');
  });
});

describe('quiz category presentation', () => {
  it('uses distinct poetry, geography, and idiom identities', () => {
    expect(quizCategoryPresentation('classical-poetry')).toEqual({
      icon: 'book-open',
      kicker: '诗意挑战',
      tone: 'primary',
    });
    expect(quizCategoryPresentation('china-geography')).toEqual({
      icon: 'map',
      kicker: '山河坐标',
      tone: 'secondary',
    });
    expect(quizCategoryPresentation('chinese-idiom')).toEqual({
      icon: 'message-circle',
      kicker: '字里乾坤',
      tone: 'warning',
    });
  });

  it('keeps unknown future categories usable', () => {
    expect(quizCategoryPresentation('future-category', 0).kicker).toBe('知识挑战');
    expect(quizCategoryPresentation('future-category', 1).kicker).toBe('趣味问答');
  });
});
