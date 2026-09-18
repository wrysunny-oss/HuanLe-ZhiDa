import { createHash } from "node:crypto";
import type { Request } from "express";
import { Prisma, type PublishStatus, type QuizReviewStatus } from "@prisma/client";
import { AppError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import type {
  QuizQuestionListQuery,
  ReviewQuizQuestionInput,
  UpdateQuizQuestionInput,
} from "./quiz.admin.schema.js";

type AuditRequest = Pick<Request, "header" | "ip" | "method" | "path">;

function auditContext(request: AuditRequest) {
  return {
    method: request.method,
    path: request.path,
    ip: request.ip,
    userAgent: request.header("user-agent"),
  };
}

function contentHash(input: UpdateQuizQuestionInput) {
  return createHash("sha256")
    .update(JSON.stringify({
      prompt: input.prompt,
      options: input.options,
      answerIndexes: input.answerIndexes,
      explanation: input.explanation ?? null,
      difficulty: input.difficulty,
      tags: input.tags,
    }))
    .digest("hex");
}

export async function listQuizQuestions(query: QuizQuestionListQuery) {
  const { page, pageSize, keyword, categoryId, status, reviewStatus } = query;
  const where: Prisma.QuizQuestionWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
    ...(reviewStatus ? { reviewStatus } : {}),
    ...(keyword ? {
      OR: [
        { prompt: { contains: keyword } },
        { externalKey: { contains: keyword } },
        { sourceRecordId: { contains: keyword } },
      ],
    } : {}),
  };
  const [list, total, statusGroups, reviewGroups, categories] = await prisma.$transaction([
    prisma.quizQuestion.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { id: true, code: true, name: true } } },
      orderBy: [{ reviewStatus: "asc" }, { id: "desc" }],
    }),
    prisma.quizQuestion.count({ where }),
    prisma.quizQuestion.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } }),
    prisma.quizQuestion.groupBy({ by: ["reviewStatus"], _count: true, orderBy: { reviewStatus: "asc" } }),
    prisma.quizCategory.findMany({ orderBy: [{ sort: "asc" }, { id: "asc" }] }),
  ]);
  return { list, page, pageSize, total, summary: { statusGroups, reviewGroups }, categories };
}

export async function updateQuizQuestion(
  operatorId: bigint,
  id: bigint,
  input: UpdateQuizQuestionInput,
  request: AuditRequest,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.quizQuestion.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 3701, "题目不存在");
    const category = await tx.quizCategory.findUnique({ where: { id: input.categoryId } });
    if (!category?.enabled) throw new AppError(422, 3702, "题目分类不存在或已停用");
    const question = await tx.quizQuestion.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        prompt: input.prompt,
        options: input.options as Prisma.InputJsonValue,
        answerIndexes: input.answerIndexes as Prisma.InputJsonValue,
        explanation: input.explanation || null,
        difficulty: input.difficulty,
        tags: input.tags as Prisma.InputJsonValue,
        contentHash: contentHash(input),
        status: "DRAFT",
        reviewStatus: "PENDING",
        reviewedAt: null,
        reviewedById: null,
      },
      include: { category: true },
    });
    await tx.auditLog.create({ data: {
      operatorId,
      action: "quiz.question.update",
      targetType: "quiz_question",
      targetId: id.toString(),
      ...auditContext(request),
      detail: { previousStatus: current.status, previousReviewStatus: current.reviewStatus },
    } });
    return question;
  });
}

async function applyReview(
  tx: Prisma.TransactionClient,
  operatorId: bigint,
  ids: bigint[],
  input: ReviewQuizQuestionInput,
  request: AuditRequest,
) {
  const questions = await tx.quizQuestion.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (questions.length !== ids.length) throw new AppError(404, 3701, "部分题目不存在，请刷新后重试");
  const reviewStatus: QuizReviewStatus = input.action === "APPROVE" ? "APPROVED" : "REJECTED";
  await tx.quizQuestion.updateMany({
    where: { id: { in: ids } },
    data: {
      reviewStatus,
      reviewedAt: new Date(),
      reviewedById: operatorId,
      ...(reviewStatus === "REJECTED" ? { status: "DRAFT" as PublishStatus } : {}),
    },
  });
  await tx.auditLog.create({ data: {
    operatorId,
    action: input.action === "APPROVE" ? "quiz.question.approve" : "quiz.question.reject",
    targetType: "quiz_question",
    targetId: ids.length === 1 ? ids[0]!.toString() : "bulk",
    ...auditContext(request),
    detail: { ids: ids.map(String), remark: input.remark ?? null },
  } });
  return { count: questions.length, reviewStatus };
}

export function reviewQuizQuestion(operatorId: bigint, id: bigint, input: ReviewQuizQuestionInput, request: AuditRequest) {
  return prisma.$transaction((tx) => applyReview(tx, operatorId, [id], input, request));
}

export function bulkReviewQuizQuestions(operatorId: bigint, ids: bigint[], input: ReviewQuizQuestionInput, request: AuditRequest) {
  return prisma.$transaction((tx) => applyReview(tx, operatorId, ids, input, request));
}

export function publishQuizQuestion(
  operatorId: bigint,
  id: bigint,
  status: "OFFLINE" | "PUBLISHED",
  request: AuditRequest,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.quizQuestion.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 3701, "题目不存在");
    if (status === "PUBLISHED" && current.reviewStatus !== "APPROVED") {
      throw new AppError(409, 3703, "只有审核通过的题目才能发布");
    }
    const question = await tx.quizQuestion.update({ where: { id }, data: { status }, include: { category: true } });
    await tx.auditLog.create({ data: {
      operatorId,
      action: status === "PUBLISHED" ? "quiz.question.publish" : "quiz.question.offline",
      targetType: "quiz_question",
      targetId: id.toString(),
      ...auditContext(request),
      detail: { previousStatus: current.status, status },
    } });
    return question;
  });
}
