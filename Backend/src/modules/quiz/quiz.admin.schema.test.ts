import assert from "node:assert/strict";
import test from "node:test";
import { reviewQuizQuestionSchema, updateQuizQuestionSchema } from "./quiz.admin.schema.js";

test("拒绝审核必须填写原因", () => {
  assert.equal(reviewQuizQuestionSchema.safeParse({ action: "REJECT" }).success, false);
  assert.equal(reviewQuizQuestionSchema.safeParse({ action: "REJECT", remark: "答案有误" }).success, true);
});

test("题目正确答案必须位于选项范围内且不能重复", () => {
  const base = { categoryId: "1", prompt: "李白是哪一朝诗人？", options: ["唐", "宋"], difficulty: 1, tags: [] };
  assert.equal(updateQuizQuestionSchema.safeParse({ ...base, answerIndexes: [0] }).success, true);
  assert.equal(updateQuizQuestionSchema.safeParse({ ...base, answerIndexes: [2] }).success, false);
  assert.equal(updateQuizQuestionSchema.safeParse({ ...base, answerIndexes: [0, 0] }).success, false);
});
