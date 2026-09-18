import { Router } from "express";
import { ok } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { actionLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/request.js";
import {
  quizHistoryQuerySchema,
  quizSessionIdSchema,
  startQuizSessionSchema,
  submitQuizAnswerSchema,
  type QuizHistoryQuery,
  type StartQuizSessionInput,
  type SubmitQuizAnswerInput,
} from "./quiz.schema.js";
import * as quizService from "./quiz.service.js";

const router = Router();
router.use(authenticate);

router.get("/categories", async (_req, res) => ok(res, await quizService.listQuizCategories()));
router.post("/sessions", actionLimiter, validate(startQuizSessionSchema), async (req, res) =>
  ok(res, await quizService.startQuizSession(req.auth!.userId, req.body as StartQuizSessionInput), "答题已开始", 201),
);
router.get("/sessions/:id", validate(quizSessionIdSchema, "params"), async (req, res) =>
  ok(res, await quizService.getQuizSession(req.auth!.userId, String(req.params.id))),
);
router.post("/sessions/:id/answers", actionLimiter, validate(quizSessionIdSchema, "params"), validate(submitQuizAnswerSchema), async (req, res) =>
  ok(res, await quizService.submitQuizAnswer(req.auth!.userId, String(req.params.id), req.body as SubmitQuizAnswerInput)),
);
router.get("/history", validate(quizHistoryQuerySchema, "query"), async (req, res) =>
  ok(res, await quizService.listQuizHistory(req.auth!.userId, res.locals.validatedQuery as QuizHistoryQuery)),
);

export default router;
