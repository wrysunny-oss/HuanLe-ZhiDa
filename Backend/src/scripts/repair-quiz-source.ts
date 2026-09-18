import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const bankPath = path.resolve(process.cwd(), "../data/quiz/poetry-tang-300.seed.json");
type BankQuestion = {externalKey: string; prompt: string; options: unknown; answerIndexes: unknown; explanation?: string};
const bank = JSON.parse(fs.readFileSync(bankPath, "utf8")) as {questions: BankQuestion[]};
const currentKeys = bank.questions.map((question) => question.externalKey);
const expectedByKey = new Map(bank.questions.map((question) => [question.externalKey, question]));
const stable = (value: unknown) => JSON.stringify(value);

async function main() {
  const retired = await prisma.quizQuestion.findMany({
    where: {externalKey: {startsWith: "poetry:tang300:", notIn: currentKeys}},
    select: {id: true, externalKey: true},
  });
  const retiredIds = retired.map((question) => question.id);
  const activeSessions = await prisma.quizSession.findMany({
    where: {status: "IN_PROGRESS"},
    select: {
      id: true,
      questions: {select: {
        promptSnapshot: true,
        optionsSnapshot: true,
        answerIndexesSnapshot: true,
        explanationSnapshot: true,
        question: {select: {externalKey: true}},
      }},
    },
  });
  const affectedSessions = activeSessions.filter((session) => session.questions.some((snapshot) => {
    const expected = expectedByKey.get(snapshot.question.externalKey);
    return !expected
      || snapshot.promptSnapshot !== expected.prompt
      || stable(snapshot.optionsSnapshot) !== stable(expected.options)
      || stable(snapshot.answerIndexesSnapshot) !== stable(expected.answerIndexes)
      || snapshot.explanationSnapshot !== (expected.explanation ?? null);
  }));

  console.log(JSON.stringify({mode: apply ? "apply" : "dry-run", retireQuestions: retired.length, abandonSessions: affectedSessions.length}, null, 2));
  if (!apply || !retired.length) return;

  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.updateMany({
      where: {id: {in: retiredIds}},
      data: {status: "OFFLINE", reviewStatus: "REJECTED", reviewedAt: new Date()},
    });
    if (affectedSessions.length) {
      await tx.quizSession.updateMany({
        where: {id: {in: affectedSessions.map((session) => session.id)}},
        data: {status: "ABANDONED"},
      });
    }
    await tx.auditLog.create({
      data: {
        action: "quiz.source.repair",
        method: "SCRIPT",
        path: "src/scripts/repair-quiz-source.ts",
        targetType: "quiz_question",
        targetId: "bulk",
        detail: {
          retiredCount: retired.length,
          retiredIds: retiredIds.map(String),
          abandonedSessionIds: affectedSessions.map((session) => session.id),
          reason: "ambiguous-source-records",
        },
      },
    });
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
