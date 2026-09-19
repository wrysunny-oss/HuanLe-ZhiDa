import { z } from "zod";

const publishStatus = z.enum(["DRAFT", "PUBLISHED", "OFFLINE"]);
const reviewStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const quizQuestionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  categoryId: z.coerce.bigint().positive().optional(),
  status: publishStatus.optional(),
  reviewStatus: reviewStatus.optional(),
});

export const quizQuestionIdSchema = z.object({
  id: z.coerce.bigint().positive(),
});

export const updateQuizQuestionSchema = z.object({
  categoryId: z.coerce.bigint().positive(),
  prompt: z.string().trim().min(2).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
  answerIndexes: z.array(z.number().int().min(0)).min(1).max(4),
  explanation: z.string().trim().max(5000).nullish(),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
}).superRefine((value, context) => {
  const uniqueAnswers = new Set(value.answerIndexes);
  if (uniqueAnswers.size !== value.answerIndexes.length) {
    context.addIssue({ code: "custom", path: ["answerIndexes"], message: "正确答案不能重复" });
  }
  if (value.answerIndexes.some((index) => index >= value.options.length)) {
    context.addIssue({ code: "custom", path: ["answerIndexes"], message: "正确答案超出选项范围" });
  }
});

export const reviewQuizQuestionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  remark: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.action === "REJECT" && (!value.remark || value.remark.length < 2)) {
    context.addIssue({ code: "custom", path: ["remark"], message: "拒绝审核时请填写至少 2 个字的原因" });
  }
});

export const bulkReviewQuizQuestionsSchema = reviewQuizQuestionSchema.extend({
  ids: z.array(z.coerce.bigint().positive()).min(1).max(100),
});

export const publishQuizQuestionSchema = z.object({
  status: z.enum(["PUBLISHED", "OFFLINE"]),
});

export const bulkPublishQuizQuestionsSchema = publishQuizQuestionSchema.extend({
  ids: z.array(z.coerce.bigint().positive()).min(1).max(100),
});

export type QuizQuestionListQuery = z.infer<typeof quizQuestionListSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionSchema>;
export type ReviewQuizQuestionInput = z.infer<typeof reviewQuizQuestionSchema>;
