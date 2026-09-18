import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import OpenCC from 'opencc-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawPath = path.join(root, '.tmp', 'chinese-poetry', 'tang300.json');
const bankPath = path.join(root, 'data', 'quiz', 'poetry-tang-300.seed.json');
const toSimplified = OpenCC.Converter({from: 't', to: 'cn'});

function clean(value) {
  return toSimplified(String(value ?? '').replace(/\s+/g, ' ').trim());
}

function verses(poem) {
  return poem.paragraphs
    .flatMap((paragraph) => clean(paragraph).split(/[，。！？；]/u))
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && line.length <= 32);
}

export function auditPoetryAnswers(rawPoems, questions) {
  const normalized = rawPoems.map((poem) => ({
    id: String(poem.id),
    author: clean(poem.author),
    title: clean(poem.title),
    lines: verses(poem),
  }));
  const firstLineCounts = new Map();
  for (const poem of normalized) {
    const firstLine = poem.lines[0];
    if (firstLine) firstLineCounts.set(firstLine, (firstLineCounts.get(firstLine) ?? 0) + 1);
  }
  const poems = new Map(normalized.map((poem) => [poem.id, poem]));
  const failures = [];
  for (const question of questions) {
    const match = /^poetry:tang300:([^:]+):(author|title|next-line)$/.exec(question.externalKey);
    if (!match) {
      failures.push({externalKey: question.externalKey, reason: 'invalid-external-key'});
      continue;
    }
    const poem = poems.get(match[1]);
    if (!poem) {
      failures.push({externalKey: question.externalKey, reason: 'source-poem-not-found'});
      continue;
    }
    if (firstLineCounts.get(poem.lines[0]) !== 1) {
      failures.push({externalKey: question.externalKey, reason: 'ambiguous-source-record'});
      continue;
    }
    const expected = match[2] === 'author' ? poem.author : match[2] === 'title' ? poem.title : poem.lines[1];
    const indexes = question.answerIndexes;
    const actual = Array.isArray(indexes) && indexes.length === 1 ? question.options[indexes[0]] : undefined;
    if (!expected || actual !== expected) {
      failures.push({externalKey: question.externalKey, reason: 'answer-mismatch', expected, actual});
    }
  }
  return {total: questions.length, passed: questions.length - failures.length, failures};
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const rawPoems = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const result = auditPoetryAnswers(rawPoems, bank.questions);
  console.log(JSON.stringify({total: result.total, passed: result.passed, failed: result.failures.length, failures: result.failures.slice(0, 20)}, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
