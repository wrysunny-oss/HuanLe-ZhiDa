import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = path.join(root, '.tmp', 'chinese-idiom-source', 'chinese-idiom-main', 'data', 'idiom.json');
const defaultBank = path.join(root, 'data', 'quiz', 'idiom-common-150.seed.json');

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function auditIdiomAnswers(raw, questions) {
  const records = new Map(raw.map((record) => [clean(record.word), {
    word: clean(record.word),
    pinyin: clean(record.pinyin),
    explanation: clean(record.explanation),
    derivation: clean(record.derivation),
  }]));
  const failures = [];
  for (const question of questions) {
    const match = /^idiom:li1fan-2024:([\u3400-\u9fff]{4}):(meaning|pinyin|completion)$/.exec(question.externalKey);
    if (!match) {
      failures.push({externalKey: question.externalKey, reason: 'invalid-external-key'});
      continue;
    }
    const [, word, kind] = match;
    const record = records.get(word);
    if (!record) {
      failures.push({externalKey: question.externalKey, reason: 'source-record-not-found'});
      continue;
    }
    const expected = kind === 'meaning' ? record.word : kind === 'pinyin' ? record.pinyin : record.word.at(-1);
    const actual = question.options?.[question.answerIndexes?.[0]];
    if (actual !== expected) {
      failures.push({externalKey: question.externalKey, reason: 'answer-mismatch', expected, actual});
      continue;
    }
    if (question.options?.length !== 4 || new Set(question.options).size !== 4) {
      failures.push({externalKey: question.externalKey, reason: 'invalid-options'});
      continue;
    }
    if (!question.explanation?.includes(`“${record.word}”`) || !question.explanation.includes(record.explanation)) {
      failures.push({externalKey: question.externalKey, reason: 'explanation-mismatch'});
      continue;
    }
    const expectedHash = crypto.createHash('sha256').update(JSON.stringify({
      prompt: question.prompt,
      options: question.options,
      answerIndexes: question.answerIndexes,
      explanation: question.explanation,
    })).digest('hex');
    if (question.contentHash !== expectedHash) failures.push({externalKey: question.externalKey, reason: 'content-hash-mismatch'});
  }
  return {passed: questions.length - failures.length, failures};
}

function argument(index, fallback) {
  return path.resolve(process.argv[index] ?? fallback);
}

function main() {
  const raw = JSON.parse(fs.readFileSync(argument(2, defaultSource), 'utf8'));
  const bank = JSON.parse(fs.readFileSync(argument(3, defaultBank), 'utf8'));
  const result = auditIdiomAnswers(raw, bank.questions);
  if (result.failures.length) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(`成语题语义审计通过：${result.passed} 道题的答案和解析均与固定来源记录一致。`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
