import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePoetryQuestions } from './generate-poetry-quiz.mjs';
import {auditPoetryAnswers} from './audit-poetry-answers.mjs';

const poems = Array.from({ length: 8 }, (_, index) => ({
  id: `poem-${index}`,
  author: `作者${index}`,
  title: `作品${index}`,
  paragraphs: [`春风第${index}句，明月第${index}句。`, `青山第${index}句，流水第${index}句。`],
  tags: ['测试'],
}));

test('诗词题生成结果可复现且默认等待审核', () => {
  const first = generatePoetryQuestions(poems, { count: 12, seed: 'fixed' });
  const second = generatePoetryQuestions(poems, { count: 12, seed: 'fixed' });
  assert.deepEqual(first, second);
  assert.equal(first.length, 12);
  assert.ok(first.every((question) => question.reviewStatus === 'PENDING' && question.status === 'DRAFT'));
  assert.ok(first.every((question) => question.options.length === 4 && new Set(question.options).size === 4));
  assert.ok(first.every((question) => question.answerIndexes.length === 1 && question.answerIndexes[0] < 4));
});

test('诗词题保留许可证与稳定内容摘要', () => {
  const questions = generatePoetryQuestions(poems, { count: 6 });
  assert.ok(questions.every((question) => question.sourceLicense === 'MIT'));
  assert.ok(questions.every((question) => /^[a-f0-9]{64}$/.test(question.contentHash)));
  assert.equal(new Set(questions.map((question) => question.externalKey)).size, questions.length);
});

test('每道题的答案索引都指向原诗中的真实答案', () => {
  const questions = generatePoetryQuestions(poems, {count: 12, seed: 'semantic-audit'});
  const result = auditPoetryAnswers(poems, questions);
  assert.equal(result.failures.length, 0);
  assert.equal(result.passed, questions.length);
});

test('首句重复的冲突语料不会进入题库', () => {
  const conflict = {
    id: 'conflict', author: '错误作者', title: '错误篇名',
    paragraphs: poems[0].paragraphs, tags: [],
  };
  const questions = generatePoetryQuestions([...poems, conflict], {count: 12, seed: 'conflict-filter'});
  assert.ok(questions.every((question) => !question.externalKey.includes('poem-0') && !question.externalKey.includes('conflict')));
});
