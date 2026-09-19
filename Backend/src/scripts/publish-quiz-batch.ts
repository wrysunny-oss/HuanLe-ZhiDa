import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

type SeedQuestion = {
  externalKey: string;
  prompt: string;
  options: unknown;
  answerIndexes: unknown;
  explanation?: string;
};

const prisma = new PrismaClient();

function argument(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function stable(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("小批发布脚本禁止在生产环境执行");
  const input = argument("input");
  const offset = Number.parseInt(argument("offset", "0")!, 10);
  const count = Number.parseInt(argument("count", "10")!, 10);
  if (!input) throw new Error("缺少 --input=<seed.json>");
  if (!Number.isInteger(offset) || offset < 0) throw new Error("--offset 必须是非负整数");
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error("--count 必须是 1 到 30 的整数");
  const inputFile = path.resolve(process.cwd(), input);
  const bank = JSON.parse(fs.readFileSync(inputFile, "utf8")) as {questions: SeedQuestion[]};
  const selected = bank.questions.slice(offset, offset + count);
  if (selected.length !== count) throw new Error(`种子题不足：需要 ${count} 道，实际 ${selected.length} 道`);
  const keys = selected.map((question) => question.externalKey);
  const stored = await prisma.quizQuestion.findMany({
    where: {externalKey: {in: keys}},
    select: {id: true, externalKey: true, prompt: true, options: true, answerIndexes: true, explanation: true, status: true, reviewStatus: true},
  });
  const storedByKey = new Map(stored.map((question) => [question.externalKey, question]));
  for (const expected of selected) {
    const actual = storedByKey.get(expected.externalKey);
    if (!actual) throw new Error(`数据库缺少待发布题目：${expected.externalKey}`);
    if (actual.prompt !== expected.prompt || stable(actual.options) !== stable(expected.options)
      || stable(actual.answerIndexes) !== stable(expected.answerIndexes)
      || actual.explanation !== (expected.explanation ?? null)) {
      throw new Error(`数据库内容与已审计种子不一致：${expected.externalKey}`);
    }
    if (actual.status !== "DRAFT" || actual.reviewStatus !== "PENDING") {
      throw new Error(`题目不是草稿待审核状态：${expected.externalKey}`);
    }
  }
  const ids = stored.map((question) => question.id);
  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.updateMany({
      where: {id: {in: ids}},
      data: {reviewStatus: "APPROVED", status: "PUBLISHED", reviewedAt: new Date()},
    });
    await tx.auditLog.create({data: {
      action: "quiz.question.publish-reviewed-batch",
      method: "SCRIPT",
      path: "src/scripts/publish-quiz-batch.ts",
      targetType: "quiz_question",
      targetId: "bulk",
      detail: {ids: ids.map(String), externalKeys: keys, seedFile: path.basename(inputFile), offset, count} as Prisma.InputJsonValue,
    }});
  });
  console.log(`已审核并小批发布 ${ids.length} 道题，其余题目保持待审核。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
