import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type SeedQuestion = {
  externalKey: string;
  prompt: string;
  options: unknown;
  answerIndexes: unknown;
  explanation?: string;
};

const prisma = new PrismaClient();
const bankPath = path.resolve(process.cwd(), "../data/quiz/poetry-tang-300.seed.json");
const bank = JSON.parse(fs.readFileSync(bankPath, "utf8")) as {questions: SeedQuestion[]};
const expectedByKey = new Map(bank.questions.map((question) => [question.externalKey, question]));
const stable = (value: unknown) => JSON.stringify(value);

async function main() {
  const questions = await prisma.quizQuestion.findMany({
    select: {id: true, externalKey: true, prompt: true, options: true, answerIndexes: true, status: true, reviewStatus: true},
  });
  const questionFailures = questions.flatMap((question) => {
    const expected = expectedByKey.get(question.externalKey);
    if (!expected) {
      return question.status === "OFFLINE" && question.reviewStatus === "REJECTED"
        ? []
        : [{id: String(question.id), externalKey: question.externalKey, reason: "retired-question-still-active"}];
    }
    if (question.prompt !== expected.prompt || stable(question.options) !== stable(expected.options) || stable(question.answerIndexes) !== stable(expected.answerIndexes)) {
      return [{id: String(question.id), externalKey: question.externalKey, reason: "database-drift"}];
    }
    return [];
  });

  const snapshots = await prisma.quizSessionQuestion.findMany({
    select: {
      id: true,
      promptSnapshot: true,
      optionsSnapshot: true,
      answerIndexesSnapshot: true,
      explanationSnapshot: true,
      selectedIndexes: true,
      isCorrect: true,
      question: {select: {externalKey: true}},
      session: {select: {status: true}},
    },
  });
  const snapshotFailures = snapshots.flatMap((snapshot) => {
    // 已完成或已作废会话必须保留当时快照；只阻止旧题或旧解析继续出现在进行中会话。
    if (snapshot.session.status !== "IN_PROGRESS") return [];
    const expected = expectedByKey.get(snapshot.question.externalKey);
    if (!expected) {
      return snapshot.session.status === "IN_PROGRESS"
        ? [{id: String(snapshot.id), externalKey: snapshot.question.externalKey, reason: "retired-snapshot-still-active"}]
        : [];
    }
    if (snapshot.promptSnapshot !== expected.prompt || stable(snapshot.optionsSnapshot) !== stable(expected.options) || stable(snapshot.answerIndexesSnapshot) !== stable(expected.answerIndexes) || snapshot.explanationSnapshot !== (expected.explanation ?? null)) {
      return [{id: String(snapshot.id), externalKey: snapshot.question.externalKey, reason: "snapshot-drift"}];
    }
    return [];
  });

  const gradingFailures = snapshots.flatMap((snapshot) => {
    if (snapshot.isCorrect === null) return [];
    const selected = Array.isArray(snapshot.selectedIndexes) ? [...snapshot.selectedIndexes].sort() : [];
    const answers = Array.isArray(snapshot.answerIndexesSnapshot) ? [...snapshot.answerIndexesSnapshot].sort() : [];
    const expectedCorrect = stable(selected) === stable(answers);
    return snapshot.isCorrect === expectedCorrect
      ? []
      : [{id: String(snapshot.id), externalKey: snapshot.question.externalKey, reason: "grading-mismatch"}];
  });

  const published = questions.filter((question) => question.status === "PUBLISHED" && question.reviewStatus === "APPROVED").length;
  const failures = [...questionFailures, ...snapshotFailures, ...gradingFailures];
  const retired = questions.filter((question) => !expectedByKey.has(question.externalKey)).length;
  console.log(JSON.stringify({questions: questions.length, published, retired, snapshots: snapshots.length, answeredSnapshots: snapshots.filter((snapshot) => snapshot.isCorrect !== null).length, failed: failures.length, failures: failures.slice(0, 20)}, null, 2));
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
