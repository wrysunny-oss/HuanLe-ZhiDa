import assert from 'node:assert/strict';
import test from 'node:test';
import {auditIdiomAnswers} from './audit-idiom-answers.mjs';
import {generateIdiomQuestions} from './generate-idiom-quiz.mjs';

const words = ['一心一意', '一帆风顺', '一见如故', '一举两得', '一鸣惊人', '一目了然', '一丝不苟', '一往无前', '一针见血', '一知半解', '七上八下', '七嘴八舌'];
const fixture = words.map((word, index) => ({
  word,
  pinyin: `pin yin ${index}`,
  explanation: `这是用于测试的第 ${index} 条完整成语释义。`,
  derivation: `测试出处 ${index}`,
}));

test('成语题可复现且默认保持草稿待审核', () => {
  const first = generateIdiomQuestions(fixture, {count: 9, seed: 'fixed'});
  const second = generateIdiomQuestions(fixture, {count: 9, seed: 'fixed'});
  assert.deepEqual(first, second);
  assert.equal(first.length, 9);
  assert.ok(first.every((question) => question.status === 'DRAFT' && question.reviewStatus === 'PENDING'));
  assert.ok(first.every((question) => question.options.length === 4 && new Set(question.options).size === 4));
});

test('语义审计能发现答案索引错乱', () => {
  const questions = generateIdiomQuestions(fixture, {count: 9, seed: 'audit'});
  assert.equal(auditIdiomAnswers(fixture, questions).failures.length, 0);
  questions[0] = {...questions[0], answerIndexes: [(questions[0].answerIndexes[0] + 1) % 4]};
  assert.equal(auditIdiomAnswers(fixture, questions).failures[0].reason, 'answer-mismatch');
});
