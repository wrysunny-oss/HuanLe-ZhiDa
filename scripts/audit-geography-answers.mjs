import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawPath = path.join(root, '.tmp', 'gb2260-archive', 'gb2260-master', 'data', 'build', 'areas.json');
const bankPath = path.join(root, 'data', 'quiz', 'geography-gb2260-2025.seed.json');

function activeRecords(raw) {
  const areas = raw?.areas ?? raw;
  return Object.values(areas).flat().filter((record) => record?.status === 'active' && record?.source === 'areacodes');
}

export function auditGeographyAnswers(raw, questions) {
  const records = activeRecords(raw);
  const byCode = new Map(records.map((record) => [String(record.code), record]));
  const prefectureProvinceByName = new Map(
    records.filter((record) => record.level === 'prefecture').map((record) => [record.name, record.province]),
  );
  const failures = [];

  for (const question of questions) {
    const match = /^geography:gb2260-2025:(\d{6}):(prefecture-province|province-prefecture|county-province|county-prefecture)$/.exec(question.externalKey);
    if (!match) {
      failures.push({ externalKey: question.externalKey, reason: 'invalid-external-key' });
      continue;
    }
    const [, code, kind] = match;
    const record = byCode.get(code);
    if (!record) {
      failures.push({ externalKey: question.externalKey, reason: 'source-record-not-found' });
      continue;
    }
    const parent = byCode.get(String(record.parent_code));
    const expected = kind === 'province-prefecture'
      ? record.name
      : kind === 'county-prefecture'
        ? parent?.name
        : record.province;
    const actual = question.options?.[question.answerIndexes?.[0]];
    if (!expected || actual !== expected) {
      failures.push({ externalKey: question.externalKey, reason: 'answer-mismatch', expected, actual });
      continue;
    }
    if (question.options.length !== 4 || new Set(question.options).size !== 4) {
      failures.push({ externalKey: question.externalKey, reason: 'invalid-options' });
      continue;
    }
    if (kind === 'province-prefecture') {
      const validOptions = question.options.filter((option) => prefectureProvinceByName.get(option) === record.province);
      if (validOptions.length !== 1 || validOptions[0] !== expected) {
        failures.push({ externalKey: question.externalKey, reason: 'ambiguous-options' });
      }
    }
  }
  return { passed: questions.length - failures.length, failures };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const result = auditGeographyAnswers(raw, bank.questions);
  if (result.failures.length) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(`地理题语义审计通过：${result.passed} 道题的答案均与 2025 年来源记录一致。`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
