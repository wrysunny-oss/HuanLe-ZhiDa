import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = path.join(root, '.tmp', 'gb2260-archive', 'gb2260-master', 'data', 'build', 'areas.json');
const DEFAULT_OUTPUT = path.join(root, 'data', 'quiz', 'geography-gb2260-2025.seed.json');
export const SOURCE_COMMIT = 'aa9f31b3a8b1dff06e815b7612f4a9e5c02a5bff';
const SOURCE_NAME = 'xihan123/gb2260（areacodes 数据）';
const SOURCE_URL = `https://github.com/xihan123/gb2260/blob/${SOURCE_COMMIT}/data/build/areas.json`;
const SOURCE_LICENSE = 'CC0-1.0';

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

function activeAreacodesRecords(raw) {
  const areas = raw?.areas ?? raw;
  if (!areas || typeof areas !== 'object' || Array.isArray(areas)) {
    throw new Error('GB2260 数据格式错误：缺少 areas 对象');
  }
  return Object.values(areas)
    .flat()
    .filter((record) => record?.status === 'active' && record?.source === 'areacodes')
    .map((record) => ({
      code: String(record.code),
      name: String(record.name).trim(),
      level: String(record.level),
      parentCode: String(record.parent_code ?? ''),
      province: String(record.province).trim(),
      path: String(record.path).trim(),
    }))
    .filter((record) => /^\d{6}$/.test(record.code) && record.name && record.province);
}

function uniqueByName(records) {
  const counts = new Map();
  for (const record of records) counts.set(record.name, (counts.get(record.name) ?? 0) + 1);
  return records.filter((record) => counts.get(record.name) === 1);
}

function selectWrongAnswers(correct, primaryPool, fallbackPool, random) {
  const candidates = [...new Set([
    ...shuffle(primaryPool, random),
    ...shuffle(fallbackPool, random),
  ].filter((value) => value && value !== correct))];
  return candidates.slice(0, 3);
}

function buildQuestion({ record, kind, prompt, correct, wrongAnswers, explanation, difficulty, tags, random }) {
  if (wrongAnswers.length < 3) return null;
  const options = shuffle([correct, ...wrongAnswers], random);
  const answerIndexes = [options.indexOf(correct)];
  const externalKey = `geography:gb2260-2025:${record.code}:${kind}`;
  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ prompt, options, answerIndexes }))
    .digest('hex');
  return {
    externalKey,
    categoryCode: 'china-geography',
    categoryName: '中国地理',
    questionType: 'SINGLE_CHOICE',
    prompt,
    options,
    answerIndexes,
    explanation,
    difficulty,
    tags: ['中国地理', '行政区划', '2025年', ...tags].slice(0, 20),
    status: 'DRAFT',
    reviewStatus: 'PENDING',
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    sourceLicense: SOURCE_LICENSE,
    sourceRecordId: record.code,
    contentHash,
  };
}

export function generateGeographyQuestions(raw, { count = 250, seed = 'huanle-zhida-geography-v1' } = {}) {
  const records = activeAreacodesRecords(raw);
  const provinces = records.filter((record) => record.level === 'province');
  const prefectures = uniqueByName(records.filter((record) => record.level === 'prefecture'));
  const counties = uniqueByName(records.filter((record) => record.level === 'county'));
  const byCode = new Map(records.map((record) => [record.code, record]));
  const provinceNames = provinces.map((record) => record.name);
  const prefectureNames = prefectures.map((record) => record.name);
  const random = seededRandom(seed);

  const prefectureProvince = shuffle(prefectures, random).map((record) => buildQuestion({
    record,
    kind: 'prefecture-province',
    prompt: `依据 2025 年行政区划数据，${record.name}属于哪个省级行政区？`,
    correct: record.province,
    wrongAnswers: selectWrongAnswers(record.province, provinceNames, [], random),
    explanation: `依据 2025 年行政区划数据，${record.name}属于${record.province}。`,
    difficulty: 1,
    tags: ['地级行政区'],
    random,
  })).filter(Boolean);

  const seenReverseProvinces = new Set();
  const reverseQuestionRecords = shuffle(prefectures, random).filter((record) => {
    if (seenReverseProvinces.has(record.province)) return false;
    seenReverseProvinces.add(record.province);
    return true;
  });
  const provincePrefecture = reverseQuestionRecords.map((record) => {
    const otherProvinces = prefectures
      .filter((candidate) => candidate.province !== record.province)
      .map((candidate) => candidate.name);
    return buildQuestion({
      record,
      kind: 'province-prefecture',
      prompt: `依据 2025 年行政区划数据，下列哪一项是${record.province}下辖的地级行政区？`,
      correct: record.name,
      wrongAnswers: selectWrongAnswers(record.name, otherProvinces, [], random),
      explanation: `依据 2025 年行政区划数据，${record.name}是${record.province}下辖的地级行政区。`,
      difficulty: 2,
      tags: ['省级行政区', '地级行政区'],
      random,
    });
  }).filter(Boolean);

  const countyProvince = shuffle(counties, random).map((record) => buildQuestion({
    record,
    kind: 'county-province',
    prompt: `依据 2025 年行政区划数据，${record.name}属于哪个省级行政区？`,
    correct: record.province,
    wrongAnswers: selectWrongAnswers(record.province, provinceNames, [], random),
    explanation: `依据 2025 年行政区划数据，${record.name}属于${record.province}。完整行政区划路径为“${record.path}”。`,
    difficulty: 2,
    tags: ['县级行政区'],
    random,
  })).filter(Boolean);

  const countyPrefecture = shuffle(counties, random).map((record) => {
    const parent = byCode.get(record.parentCode);
    if (!parent || parent.level !== 'prefecture') return null;
    const sameProvince = prefectures
      .filter((candidate) => candidate.province === record.province && candidate.code !== parent.code)
      .map((candidate) => candidate.name);
    const otherPrefectures = prefectureNames.filter((name) => name !== parent.name);
    return buildQuestion({
      record,
      kind: 'county-prefecture',
      prompt: `依据 2025 年行政区划数据，${record.name}由哪个地级行政区管辖？`,
      correct: parent.name,
      wrongAnswers: selectWrongAnswers(parent.name, sameProvince, otherPrefectures, random),
      explanation: `依据 2025 年行政区划数据，${record.name}由${parent.name}管辖，完整路径为“${record.path}”。`,
      difficulty: 3,
      tags: ['县级行政区', '地级行政区'],
      random,
    });
  }).filter(Boolean);

  const quotas = [
    [prefectureProvince, Math.ceil(count * 0.32)],
    [provincePrefecture, Math.ceil(count * 0.20)],
    [countyProvince, Math.ceil(count * 0.28)],
    [countyPrefecture, count],
  ];
  const selected = [];
  for (const [pool, limit] of quotas) {
    selected.push(...pool.slice(0, Math.min(limit, count - selected.length)));
    if (selected.length === count) break;
  }
  if (selected.length < count) {
    throw new Error(`有效地理题不足：需要 ${count}，实际 ${selected.length}`);
  }
  return shuffle(selected, seededRandom(`${seed}:final`));
}

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const source = path.resolve(argument('source', DEFAULT_SOURCE));
  const output = path.resolve(argument('output', DEFAULT_OUTPUT));
  const count = Number.parseInt(argument('count', '250'), 10);
  if (!Number.isInteger(count) || count < 1) throw new Error('--count 必须是正整数');
  const raw = JSON.parse(fs.readFileSync(source, 'utf8'));
  const questions = generateGeographyQuestions(raw, {
    count,
    seed: argument('seed', 'huanle-zhida-geography-v1'),
  });
  const bank = {
    schemaVersion: 1,
    generatedAt: '2026-09-18T00:00:00.000Z',
    source: {
      name: SOURCE_NAME,
      url: SOURCE_URL,
      license: SOURCE_LICENSE,
      commit: SOURCE_COMMIT,
      dataYear: 2025,
    },
    questions,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  console.log(`已生成 ${questions.length} 道待审核中国地理题：${path.relative(root, output)}`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
