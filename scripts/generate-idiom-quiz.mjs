import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = path.join(root, '.tmp', 'chinese-idiom-source', 'chinese-idiom-main', 'data', 'idiom.json');
const DEFAULT_OUTPUT = path.join(root, 'data', 'quiz', 'idiom-common-150.seed.json');
export const SOURCE_COMMIT = '44aca4fd83942a38b52ff7fa0613eee2b138c0c9';
const SOURCE_NAME = 'Li1Fan/chinese-idiom';
const SOURCE_URL = `https://github.com/Li1Fan/chinese-idiom/blob/${SOURCE_COMMIT}/data/idiom.json`;
const SOURCE_LICENSE = 'MIT';

// 只从人工列出的常用四字成语中取题，避免把生僻、争议或不适合大众产品的词条随机带入题库。
const COMMON_IDIOMS = `
一心一意 一帆风顺 一见如故 一举两得 一鸣惊人 一目了然 一丝不苟 一往无前 一针见血 一知半解
七上八下 七嘴八舌 三心二意 三长两短 三顾茅庐 大公无私 大惊小怪 大同小异 大显身手 大智若愚
小心翼翼 不约而同 不知所措 不言而喻 不可思议 不屈不挠 不速之客 不遗余力 不翼而飞 不耻下问
井井有条 亡羊补牢 五湖四海 今非昔比 从容不迫 以身作则 以逸待劳 以卵击石 以貌取人 休戚与共
众志成城 全力以赴 兴高采烈 再接再厉 冰清玉洁 刻舟求剑 力不从心 功成名就 半途而废 华而不实
名列前茅 名副其实 后来居上 同舟共济 各抒己见 因地制宜 坚持不懈 坚韧不拔 坐井观天 墨守成规
声东击西 多此一举 夜以继日 大器晚成 天衣无缝 如火如荼 如鱼得水 守株待兔 安居乐业 实事求是
家喻户晓 专心致志 居安思危 左右为难 开门见山 异想天开 当机立断 得不偿失 得心应手 志同道合
恍然大悟 息息相关 惊弓之鸟 想方设法 愚公移山 手不释卷 才华横溢 扬长避短 抛砖引玉 拔苗助长
持之以恒 指鹿为马 按部就班 掩耳盗铃 推陈出新 无与伦比 无可奈何 无微不至 日新月异 明察秋毫
望梅止渴 未雨绸缪 本末倒置 杞人忧天 来之不易 梦寐以求 水到渠成 水滴石穿 流连忘返 海阔天空
滥竽充数 画蛇添足 画龙点睛 百发百中 百折不挠 目不转睛 相辅相成 真知灼见 知己知彼 破釜沉舟
精益求精 纸上谈兵 自相矛盾 茅塞顿开 脚踏实地 胸有成竹 脱颖而出 自强不息 言而有信 触类旁通
见义勇为 见多识广 见异思迁 语重心长 谈笑风生 豁然开朗 越俎代庖 跃跃欲试 迎刃而解 迫不及待
适得其反 郑人买履 锦上添花 集思广益 雪中送炭 雷厉风行 青出于蓝 顺理成章 风雨同舟 高瞻远瞩
鹤立鸡群 黔驴技穷 鼠目寸光 龙飞凤舞 齐心协力 临渴掘井 举一反三 乐此不疲 争先恐后 事半功倍
事倍功半 人山人海 人云亦云 人杰地灵 任重道远 依依不舍 先见之明 光明磊落 入木三分 兵不厌诈
前车之鉴 势如破竹 卧薪尝胆 变本加厉 口若悬河 叶公好龙 唇亡齿寒 塞翁失马 孜孜不倦 学以致用
对症下药 弄巧成拙 循序渐进 心旷神怡 急中生智 承前启后 捷足先登 旗开得胜 春风化雨 朝三暮四
欣欣向荣 步步为营 毛遂自荐 沧海一粟 津津有味 熟能生巧 独具匠心 班门弄斧 理直气壮 瓜熟蒂落
相得益彰 神机妙算 积少成多 空前绝后 笑逐颜开 管中窥豹 绝处逢生 群策群力 老马识途 耳濡目染
聚精会神 背水一战 自力更生 苦尽甘来 轻而易举 过目不忘 金玉良言 防微杜渐 随机应变 饮水思源
`;

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
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function selectDistractors(correct, values, random) {
  return shuffle([...new Set(values.filter((value) => value && value !== correct))], random).slice(0, 3);
}

function buildQuestion(record, kind, pool, random) {
  let prompt;
  let correct;
  let distractorPool;
  if (kind === 'meaning') {
    prompt = `下列哪个成语最符合释义“${record.explanation}”？`;
    correct = record.word;
    distractorPool = pool.map((item) => item.word);
  } else if (kind === 'pinyin') {
    prompt = `成语“${record.word}”的正确读音是？`;
    correct = record.pinyin;
    distractorPool = pool.map((item) => item.pinyin);
  } else {
    prompt = `成语“${record.word.slice(0, 3)}__”中应填入哪个字？`;
    correct = record.word.at(-1);
    distractorPool = pool.map((item) => item.word.at(-1));
  }
  const wrongAnswers = selectDistractors(correct, distractorPool, random);
  if (wrongAnswers.length !== 3) throw new Error(`成语 ${record.word} 缺少有效干扰项`);
  const options = shuffle([correct, ...wrongAnswers], random);
  const answerIndexes = [options.indexOf(correct)];
  const explanation = `“${record.word}”读作“${record.pinyin}”，意思是：${record.explanation}${record.derivation ? ` 出处：${record.derivation}` : ''}`;
  const contentHash = crypto.createHash('sha256').update(JSON.stringify({prompt, options, answerIndexes, explanation})).digest('hex');
  return {
    externalKey: `idiom:li1fan-2024:${record.word}:${kind}`,
    categoryCode: 'chinese-idiom',
    categoryName: '成语知识',
    questionType: 'SINGLE_CHOICE',
    prompt,
    options,
    answerIndexes,
    explanation,
    difficulty: kind === 'meaning' ? 2 : 1,
    tags: ['成语知识', kind === 'meaning' ? '释义辨析' : kind === 'pinyin' ? '成语读音' : '成语补全'],
    status: 'DRAFT',
    reviewStatus: 'PENDING',
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    sourceLicense: SOURCE_LICENSE,
    sourceRecordId: record.word,
    contentHash,
  };
}

export function generateIdiomQuestions(raw, {count = 150, seed = 'huanle-zhida-idiom-v1'} = {}) {
  const requested = COMMON_IDIOMS.trim().split(/\s+/);
  const requestedSet = new Set(requested);
  const records = raw
    .map((record) => ({
      word: clean(record.word),
      pinyin: clean(record.pinyin),
      explanation: clean(record.explanation),
      derivation: clean(record.derivation),
    }))
    .filter((record) => requestedSet.has(record.word) && /^[\u3400-\u9fff]{4}$/.test(record.word)
      && record.pinyin && record.explanation.length >= 8 && record.explanation.length <= 180);
  const unique = [...new Map(records.map((record) => [record.word, record])).values()];
  if (unique.length < count) throw new Error(`可用常用成语不足：需要 ${count}，实际 ${unique.length}`);
  const selected = shuffle(unique, seededRandom(`${seed}:select`)).slice(0, count);
  const random = seededRandom(`${seed}:questions`);
  return selected.map((record, index) => buildQuestion(record, ['meaning', 'pinyin', 'completion'][index % 3], unique, random));
}

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function main() {
  const source = path.resolve(argument('source', DEFAULT_SOURCE));
  const output = path.resolve(argument('output', DEFAULT_OUTPUT));
  const count = Number.parseInt(argument('count', '150'), 10);
  if (!Number.isInteger(count) || count < 1) throw new Error('--count 必须是正整数');
  const questions = generateIdiomQuestions(JSON.parse(fs.readFileSync(source, 'utf8')), {
    count,
    seed: argument('seed', 'huanle-zhida-idiom-v1'),
  });
  const bank = {
    schemaVersion: 1,
    generatedAt: '2026-09-19T00:00:00.000Z',
    source: {name: SOURCE_NAME, url: SOURCE_URL, license: SOURCE_LICENSE, commit: SOURCE_COMMIT},
    questions,
  };
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  console.log(`已生成 ${questions.length} 道待审核成语题：${path.relative(root, output)}`);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
