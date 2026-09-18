import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import OpenCC from 'opencc-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = path.join(root, '.tmp', 'chinese-poetry', 'tang300.json');
const DEFAULT_OUTPUT = path.join(root, 'data', 'quiz', 'poetry-tang-300.seed.json');
const SOURCE_COMMIT = 'b8594f81a89752241442f2ce267d6f66f96704ee';
const SOURCE_NAME = 'chinese-poetry/唐诗三百首';
const SOURCE_URL = `https://github.com/chinese-poetry/chinese-poetry/blob/${SOURCE_COMMIT}/全唐诗/唐诗三百首.json`;
const SOURCE_LICENSE = 'MIT';
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

function seededRandom(seedText) {
  let state = Number.parseInt(crypto.createHash('sha256').update(seedText).digest('hex').slice(0, 8), 16) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function shuffle(values, random) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function clean(value) {
  return toSimplified(String(value ?? '').replace(/\s+/g, ' ').trim());
}

function verses(poem) {
  return poem.paragraphs
    .flatMap((paragraph) => clean(paragraph).split(/[，。！？；]/u))
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && line.length <= 32);
}

function distractors(correct, pool, random, count = 3) {
  const candidates = shuffle([...new Set(pool.filter((value) => value && value !== correct))], random);
  return candidates.slice(0, count);
}

function buildQuestion({ poem, kind, prompt, correct, optionPool, difficulty, tags, random }) {
  const wrong = distractors(correct, optionPool, random);
  if (wrong.length < 3) return null;
  const options = shuffle([correct, ...wrong], random);
  const answerIndexes = [options.indexOf(correct)];
  const externalKey = `poetry:tang300:${poem.id}:${kind}`;
  const contentHash = crypto.createHash('sha256').update(JSON.stringify({ prompt, options, answerIndexes })).digest('hex');
  const explanation = kind === 'author'
    ? `《${poem.title}》的作者是${poem.author}。`
    : kind === 'title'
      ? `这句诗出自《${poem.title}》，作者是${poem.author}。`
      : `原诗下一句是“${correct}”，出自${poem.author}的《${poem.title}》。`;
  return {
    externalKey,
    categoryCode: 'classical-poetry',
    categoryName: '诗词文化',
    questionType: 'SINGLE_CHOICE',
    prompt,
    options,
    answerIndexes,
    explanation,
    difficulty,
    tags: ['唐诗', ...tags].slice(0, 20),
    status: 'DRAFT',
    reviewStatus: 'PENDING',
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    sourceLicense: SOURCE_LICENSE,
    sourceRecordId: poem.id,
    contentHash,
  };
}

export function generatePoetryQuestions(rawPoems, { count = 600, seed = 'huanle-zhida-poetry-v1' } = {}) {
  const normalizedPoems = rawPoems.map((poem) => ({
    id: String(poem.id),
    author: clean(poem.author),
    title: clean(poem.title),
    paragraphs: Array.isArray(poem.paragraphs) ? poem.paragraphs : [],
    tags: Array.isArray(poem.tags) ? poem.tags.map(clean).filter(Boolean) : [],
  })).filter((poem) => poem.id && poem.author && poem.title && verses(poem).length >= 2);
  // 同一首句在开源语料中可能存在异作者、异篇名或异文记录。无法自动裁定时全部排除，
  // 避免把数据源冲突包装成唯一正确答案。
  const firstLineCounts = new Map();
  for (const poem of normalizedPoems) {
    const firstLine = verses(poem)[0];
    firstLineCounts.set(firstLine, (firstLineCounts.get(firstLine) ?? 0) + 1);
  }
  const poems = normalizedPoems.filter((poem) => firstLineCounts.get(verses(poem)[0]) === 1);
  const random = seededRandom(seed);
  const authors = poems.map((poem) => poem.author);
  const titles = poems.map((poem) => poem.title);
  const allVerses = poems.flatMap(verses);
  const generated = [];

  for (const poem of shuffle(poems, random)) {
    const lines = verses(poem);
    const excerpt = lines[0];
    const common = { poem, random, tags: poem.tags };
    generated.push(buildQuestion({
      ...common,
      kind: 'author',
      prompt: `诗句“${excerpt}”出自哪位诗人？`,
      correct: poem.author,
      optionPool: authors,
      difficulty: 1,
    }));
    generated.push(buildQuestion({
      ...common,
      kind: 'title',
      prompt: `诗句“${excerpt}”出自下列哪一首作品？`,
      correct: poem.title,
      optionPool: titles,
      difficulty: 2,
    }));
    generated.push(buildQuestion({
      ...common,
      kind: 'next-line',
      prompt: `“${lines[0]}”的下一句是？`,
      correct: lines[1],
      optionPool: allVerses.filter((line) => Math.abs(line.length - lines[1].length) <= 2),
      difficulty: 2,
    }));
  }

  return generated.filter(Boolean).slice(0, count);
}

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const source = path.resolve(argument('source', DEFAULT_SOURCE));
  const output = path.resolve(argument('output', DEFAULT_OUTPUT));
  const count = Number.parseInt(argument('count', '600'), 10);
  if (!Number.isInteger(count) || count < 1) throw new Error('--count 必须是正整数');
  const rawPoems = JSON.parse(fs.readFileSync(source, 'utf8'));
  const questions = generatePoetryQuestions(rawPoems, { count, seed: argument('seed', 'huanle-zhida-poetry-v1') });
  if (questions.length < count) throw new Error(`有效题目不足：需要 ${count}，实际 ${questions.length}`);
  const bank = {
    schemaVersion: 1,
    generatedAt: '2026-09-18T00:00:00.000Z',
    source: { name: SOURCE_NAME, url: SOURCE_URL, license: SOURCE_LICENSE, commit: SOURCE_COMMIT },
    questions,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  console.log(`已生成 ${questions.length} 道待审核诗词题：${path.relative(root, output)}`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
