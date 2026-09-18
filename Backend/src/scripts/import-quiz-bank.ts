import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const optionSchema = z.string().trim().min(1).max(500);
const questionSchema = z.object({
  externalKey: z.string().min(1).max(160),
  categoryCode: z.string().min(1).max(50),
  categoryName: z.string().min(1).max(100),
  questionType: z.enum(["SINGLE_CHOICE", "TRUE_FALSE"]),
  prompt: z.string().min(1).max(10_000),
  options: z.array(optionSchema).min(2).max(8),
  answerIndexes: z.array(z.number().int().nonnegative()).min(1),
  explanation: z.string().max(20_000).optional(),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string().min(1).max(50)).max(20),
  status: z.literal("DRAFT"),
  reviewStatus: z.literal("PENDING"),
  sourceName: z.string().min(1).max(120),
  sourceUrl: z.url().max(1000),
  sourceLicense: z.string().min(1).max(80),
  sourceRecordId: z.string().min(1).max(160),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).superRefine((question, context) => {
  if (new Set(question.options).size !== question.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "选项不能重复" });
  }
  for (const answerIndex of question.answerIndexes) {
    if (answerIndex >= question.options.length) {
      context.addIssue({ code: "custom", path: ["answerIndexes"], message: "答案索引超出选项范围" });
    }
  }
});

const bankSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  source: z.object({ name: z.string(), url: z.url(), license: z.string() }),
  questions: z.array(questionSchema).min(1),
});

const defaultFile = path.resolve(process.cwd(), "../data/quiz/poetry-tang-300.seed.json");
const inputFile = path.resolve(process.argv[2] ?? defaultFile);
const bank = bankSchema.parse(JSON.parse(fs.readFileSync(inputFile, "utf8")));
const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const categoryCache = new Map<string, bigint>();
  for (const question of bank.questions) {
    let categoryId = categoryCache.get(question.categoryCode);
    if (!categoryId) {
      const category = await prisma.quizCategory.upsert({
        where: { code: question.categoryCode },
        create: { code: question.categoryCode, name: question.categoryName },
        update: { name: question.categoryName },
      });
      categoryId = category.id;
      categoryCache.set(question.categoryCode, categoryId);
    }

    const { categoryCode: _categoryCode, categoryName: _categoryName, ...data } = question;
    await prisma.quizQuestion.upsert({
      where: { externalKey: question.externalKey },
      create: { ...data, categoryId },
      update: {
        ...data,
        categoryId,
        // 重新导入不能覆盖已经完成的人工审核结果。
        reviewStatus: undefined,
        status: undefined,
      },
    });
  }
  console.log(`题库导入完成：${bank.questions.length} 道，来源 ${bank.source.name}`);
}

const operation = dryRun
  ? Promise.resolve(console.log(`题库校验通过：${bank.questions.length} 道，来源 ${bank.source.name}`))
  : main();

operation
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
