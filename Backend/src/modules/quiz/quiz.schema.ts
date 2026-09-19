import { z } from "zod";

export const startQuizSessionSchema = z.object({
  requestId: z.uuid(),
  categoryId: z.coerce.bigint().positive().optional(),
  questionCount: z.number().int().min(5).max(20).default(10),
});

export const quizSessionIdSchema = z.object({
  id: z.uuid(),
});

export const submitQuizAnswerSchema = z.object({
  position: z.number().int().min(1).max(20),
  selectedIndexes: z.array(z.number().int().min(0).max(7)).length(1),
});

export const quizHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const wrongQuestionListSchema = quizHistoryQuerySchema;

export const startWrongQuestionPracticeSchema = z.object({
  requestId: z.uuid(),
  questionCount: z.number().int().min(1).max(20).default(10),
});

export type StartQuizSessionInput = z.infer<typeof startQuizSessionSchema>;
export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerSchema>;
export type QuizHistoryQuery = z.infer<typeof quizHistoryQuerySchema>;
export type WrongQuestionListQuery = z.infer<typeof wrongQuestionListSchema>;
export type StartWrongQuestionPracticeInput = z.infer<typeof startWrongQuestionPracticeSchema>;
