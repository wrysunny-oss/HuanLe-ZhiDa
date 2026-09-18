import assert from "node:assert/strict";
import test from "node:test";
import { startQuizSessionSchema, submitQuizAnswerSchema } from "./quiz.schema.js";

test("答题会话限制为 5 到 20 道", () => {
  const requestId = "8dff25f0-26e8-4d62-860e-2a9b1456d604";
  assert.equal(startQuizSessionSchema.safeParse({ requestId, questionCount: 10 }).success, true);
  assert.equal(startQuizSessionSchema.safeParse({ requestId, questionCount: 4 }).success, false);
  assert.equal(startQuizSessionSchema.safeParse({ requestId, questionCount: 21 }).success, false);
});

test("当前单选题只接受一个答案", () => {
  assert.equal(submitQuizAnswerSchema.safeParse({ position: 1, selectedIndexes: [0] }).success, true);
  assert.equal(submitQuizAnswerSchema.safeParse({ position: 1, selectedIndexes: [] }).success, false);
  assert.equal(submitQuizAnswerSchema.safeParse({ position: 1, selectedIndexes: [0, 1] }).success, false);
});
