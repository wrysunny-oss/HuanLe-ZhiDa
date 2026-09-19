import assert from "node:assert/strict";
import test from "node:test";
import { bulkPublishQuizQuestionsSchema, reviewQuizQuestionSchema, updateQuizQuestionSchema } from "./quiz.admin.schema.js";

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

test("批量上下线限制操作数量并拒绝无效状态", () => {
  assert.equal(bulkPublishQuizQuestionsSchema.safeParse({ids: ["1", "2"], status: "PUBLISHED"}).success, true);
  assert.equal(bulkPublishQuizQuestionsSchema.safeParse({ids: ["1"], status: "DRAFT"}).success, false);
  assert.equal(bulkPublishQuizQuestionsSchema.safeParse({ids: [], status: "OFFLINE"}).success, false);
  assert.equal(bulkPublishQuizQuestionsSchema.safeParse({ids: Array.from({length: 101}, (_, index) => index + 1), status: "OFFLINE"}).success, false);
});
