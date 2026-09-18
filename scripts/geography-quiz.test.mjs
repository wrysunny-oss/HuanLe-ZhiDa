import assert from 'node:assert/strict';
import test from 'node:test';
import { auditGeographyAnswers } from './audit-geography-answers.mjs';
import { generateGeographyQuestions } from './generate-geography-quiz.mjs';

function record(code, name, level, province, parentCode = '', path = name) {
  return { code, name, level, province, parent_code: parentCode, path, status: 'active', source: 'areacodes' };
}

const fixture = { areas: Object.fromEntries([
  record('110000', '甲省', 'province', '甲省'),
  record('120000', '乙省', 'province', '乙省'),
  record('130000', '丙省', 'province', '丙省'),
  record('140000', '丁省', 'province', '丁省'),
  ...Array.from({ length: 12 }, (_, index) => {
    const provinceIndex = index % 4;
    const provinceCode = `${11 + provinceIndex}0000`;
    const province = ['甲省', '乙省', '丙省', '丁省'][provinceIndex];
    return record(`${11 + provinceIndex}${String(index + 1).padStart(2, '0')}00`, `地级${index}市`, 'prefecture', province, provinceCode, `${province}/地级${index}市`);
  }),
  ...Array.from({ length: 24 }, (_, index) => {
    const prefectureIndex = index % 12;
    const provinceIndex = prefectureIndex % 4;
    const province = ['甲省', '乙省', '丙省', '丁省'][provinceIndex];
    const parentCode = `${11 + provinceIndex}${String(prefectureIndex + 1).padStart(2, '0')}00`;
    return record(`${11 + provinceIndex}${String(prefectureIndex + 1).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`, `县级${index}区`, 'county', province, parentCode, `${province}/地级${prefectureIndex}市/县级${index}区`);
  }),
].map((item) => [item.code, [item]])) };

test('地理题可复现，且默认进入草稿和待审核状态', () => {
  const first = generateGeographyQuestions(fixture, { count: 30, seed: 'fixed' });
  const second = generateGeographyQuestions(fixture, { count: 30, seed: 'fixed' });
  assert.deepEqual(first, second);
  assert.equal(first.length, 30);
  assert.ok(first.every((question) => question.status === 'DRAFT' && question.reviewStatus === 'PENDING'));
  assert.ok(first.every((question) => question.options.length === 4 && new Set(question.options).size === 4));
  assert.equal(new Set(first.map((question) => question.externalKey)).size, first.length);
  assert.equal(new Set(first.map((question) => question.prompt)).size, first.length);
});

test('地理题答案与同一条来源记录一致', () => {
  const questions = generateGeographyQuestions(fixture, { count: 30, seed: 'audit' });
  const result = auditGeographyAnswers(fixture, questions);
  assert.equal(result.failures.length, 0);
  assert.equal(result.passed, questions.length);
});

test('语义审计可以发现被改乱的答案索引', () => {
  const questions = generateGeographyQuestions(fixture, { count: 10, seed: 'corrupt' });
  questions[0] = { ...questions[0], answerIndexes: [(questions[0].answerIndexes[0] + 1) % 4] };
  const result = auditGeographyAnswers(fixture, questions);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].reason, 'answer-mismatch');
});
