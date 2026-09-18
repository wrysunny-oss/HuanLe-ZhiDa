import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { productModules } from "../../generated/product.generated.js";
import type { QuizHistoryQuery, StartQuizSessionInput, SubmitQuizAnswerInput } from "./quiz.schema.js";

const DAILY_REWARDED_ROUND_LIMIT = 5;
const QUIZ_REWARD_RULE_CODE = "QUIZ_ROUND_COMPLETE";

type SessionWithQuestions = Prisma.QuizSessionGetPayload<{
  include: { category: { select: { name: true } }; questions: { orderBy: { position: "asc" } } };
}>;

function numberArray(value: Prisma.JsonValue | null): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item)) : [];
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = randomInt(index + 1);
    [result[index], result[selected]] = [result[selected]!, result[index]!];
  }
  return result;
}

function chinaDayRange(now = new Date()) {
  const offset = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function publicQuestion(question: SessionWithQuestions["questions"][number]) {
  return {
    position: question.position,
    prompt: question.promptSnapshot,
    options: stringArray(question.optionsSnapshot),
    categoryName: question.categoryNameSnapshot,
  };
}

function presentSession(session: SessionWithQuestions) {
  const next = session.questions.find((question) => !question.answeredAt);
  return {
    id: session.id,
    status: session.status,
    categoryName: session.category?.name ?? "综合挑战",
    totalQuestions: session.totalQuestions,
    answeredCount: session.answeredCount,
    correctCount: session.correctCount,
    rewardCoins: session.rewardCoins,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    question: next ? publicQuestion(next) : null,
  };
}

async function ownedSession(userId: bigint, sessionId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const session = await tx.quizSession.findFirst({
    where: { id: sessionId, userId },
    include: { category: { select: { name: true } }, questions: { orderBy: { position: "asc" } } },
  });
  if (!session) throw new AppError(404, 3710, "答题会话不存在");
  return session;
}

export async function listQuizCategories() {
  const categories = await prisma.quizCategory.findMany({
    where: { enabled: true },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { questions: { where: { status: "PUBLISHED", reviewStatus: "APPROVED" } } } },
    },
  });
  return categories
    .map((category) => ({ id: category.id, code: category.code, name: category.name, questionCount: category._count.questions }))
    .filter((category) => category.questionCount > 0);
}

export async function startQuizSession(userId: bigint, input: StartQuizSessionInput) {
  const existing = await prisma.quizSession.findUnique({
    where: { userId_requestId: { userId, requestId: input.requestId } },
    include: { category: { select: { name: true } }, questions: { orderBy: { position: "asc" } } },
  });
  if (existing) return { ...presentSession(existing), duplicate: true };

  if (input.categoryId) {
    const category = await prisma.quizCategory.findFirst({ where: { id: input.categoryId, enabled: true } });
    if (!category) throw new AppError(404, 3711, "题目分类不存在或已停用");
  }
  const eligible = await prisma.quizQuestion.findMany({
    where: {
      status: "PUBLISHED",
      reviewStatus: "APPROVED",
      category: { enabled: true },
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    include: { category: { select: { name: true } } },
  });
  if (eligible.length < input.questionCount) {
    throw new AppError(409, 3712, `当前可用题目不足 ${input.questionCount} 道，请稍后再试`);
  }
  const selected = shuffle(eligible).slice(0, input.questionCount);
  const session = await prisma.quizSession.create({
    data: {
      requestId: input.requestId,
      userId,
      categoryId: input.categoryId,
      totalQuestions: input.questionCount,
      questions: {
        create: selected.map((question, index) => ({
          questionId: question.id,
          position: index + 1,
          promptSnapshot: question.prompt,
          optionsSnapshot: question.options as Prisma.InputJsonValue,
          answerIndexesSnapshot: question.answerIndexes as Prisma.InputJsonValue,
          explanationSnapshot: question.explanation,
          categoryNameSnapshot: question.category.name,
        })),
      },
    },
    include: { category: { select: { name: true } }, questions: { orderBy: { position: "asc" } } },
  });
  return { ...presentSession(session), duplicate: false };
}

export async function getQuizSession(userId: bigint, sessionId: string) {
  return presentSession(await ownedSession(userId, sessionId));
}

function answerResult(session: SessionWithQuestions, position: number) {
  const question = session.questions.find((item) => item.position === position);
  if (!question?.answeredAt) return null;
  const next = session.questions.find((item) => !item.answeredAt);
  return {
    position,
    correct: Boolean(question.isCorrect),
    selectedIndexes: numberArray(question.selectedIndexes),
    correctAnswerIndexes: numberArray(question.answerIndexesSnapshot),
    explanation: question.explanationSnapshot,
    answeredCount: session.answeredCount,
    correctCount: session.correctCount,
    completed: session.status === "COMPLETED",
    rewardCoins: session.rewardCoins,
    nextQuestion: next ? publicQuestion(next) : null,
  };
}

export function submitQuizAnswer(userId: bigint, sessionId: string, input: SubmitQuizAnswerInput) {
  return prisma.$transaction(async (tx) => {
    const session = await ownedSession(userId, sessionId, tx);
    const existing = answerResult(session, input.position);
    if (existing) return { ...existing, duplicate: true };
    if (session.status !== "IN_PROGRESS") throw new AppError(409, 3713, "本局答题已经结束");
    const current = session.questions.find((question) => !question.answeredAt);
    if (!current || current.position !== input.position) throw new AppError(409, 3714, "请按题目顺序作答");
    const options = stringArray(current.optionsSnapshot);
    if (input.selectedIndexes.some((index) => index >= options.length)) throw new AppError(422, 3715, "所选答案超出选项范围");
    const correctIndexes = numberArray(current.answerIndexesSnapshot).sort((a, b) => a - b);
    const selectedIndexes = [...new Set(input.selectedIndexes)].sort((a, b) => a - b);
    const correct = selectedIndexes.length === correctIndexes.length && selectedIndexes.every((value, index) => value === correctIndexes[index]);
    const updated = await tx.quizSessionQuestion.updateMany({
      where: { id: current.id, answeredAt: null },
      data: { selectedIndexes, isCorrect: correct, answeredAt: new Date() },
    });
    if (updated.count !== 1) {
      const latest = await ownedSession(userId, sessionId, tx);
      const duplicate = answerResult(latest, input.position);
      if (duplicate) return { ...duplicate, duplicate: true };
      throw new AppError(409, 3716, "答案提交冲突，请刷新后重试");
    }

    const completed = session.answeredCount + 1 === session.totalQuestions;
    let rewardCoins = 0n;
    if (completed && productModules.rewards) {
      const { start, end } = chinaDayRange();
      const [rewardRule, rewardedRounds, user] = await Promise.all([
        tx.rewardRule.findUnique({ where: { code: QUIZ_REWARD_RULE_CODE } }),
        tx.quizSession.count({ where: { userId, status: "COMPLETED", rewardCoins: { gt: 0n }, completedAt: { gte: start, lt: end } } }),
        tx.user.findUniqueOrThrow({ where: { id: userId }, select: { riskStatus: true } }),
      ]);
      if (rewardRule?.enabled && rewardRule.amount > 0n && rewardedRounds < DAILY_REWARDED_ROUND_LIMIT && ["NORMAL", "WATCH"].includes(user.riskStatus)) {
        rewardCoins = rewardRule.amount;
        const updatedUser = await tx.user.update({ where: { id: userId }, data: { coinBalance: { increment: rewardCoins } }, select: { coinBalance: true } });
        await tx.rewardLedger.create({ data: { userId, type: "TASK", amount: rewardCoins, balanceAfter: updatedUser.coinBalance, title: "完成一局答题", bizId: `quiz-session:${session.id}` } });
      }
    }
    await tx.quizSession.update({
      where: { id: session.id },
      data: {
        answeredCount: { increment: 1 },
        correctCount: { increment: correct ? 1 : 0 },
        ...(completed ? { status: "COMPLETED", completedAt: new Date(), rewardCoins } : {}),
      },
    });
    const latest = await ownedSession(userId, sessionId, tx);
    return { ...answerResult(latest, input.position)!, duplicate: false };
  }, { isolationLevel: "Serializable" });
}

export async function listQuizHistory(userId: bigint, query: QuizHistoryQuery) {
  const where = { userId, status: "COMPLETED" as const };
  const [list, total] = await prisma.$transaction([
    prisma.quizSession.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { category: { select: { name: true } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.quizSession.count({ where }),
  ]);
  return {
    list: list.map((session) => ({
      id: session.id,
      totalQuestions: session.totalQuestions,
      correctCount: session.correctCount,
      rewardCoins: session.rewardCoins,
      completedAt: session.completedAt,
      category: session.category,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    dailyRewardLimit: DAILY_REWARDED_ROUND_LIMIT,
  };
}
