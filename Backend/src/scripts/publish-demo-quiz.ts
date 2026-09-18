import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_COUNT = 30;

function isValidQuestion(question: { options: unknown; answerIndexes: unknown; prompt: string }) {
  if (!question.prompt.trim() || !Array.isArray(question.options) || question.options.length < 2) return false;
  if (!question.options.every((option) => typeof option === "string" && option.trim())) return false;
  if (!Array.isArray(question.answerIndexes) || question.answerIndexes.length !== 1) return false;
  const answer = question.answerIndexes[0];
  return Number.isInteger(answer) && Number(answer) >= 0 && Number(answer) < question.options.length;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("演示题发布脚本禁止在生产环境执行");
  const alreadyPublished = await prisma.quizQuestion.count({ where: { reviewStatus: "APPROVED", status: "PUBLISHED" } });
  const needed = Math.max(0, TARGET_COUNT - alreadyPublished);
  if (!needed) {
    console.log(`已有 ${alreadyPublished} 道已发布题目，无需处理。`);
    return;
  }
  const candidates = await prisma.quizQuestion.findMany({
    where: { reviewStatus: "PENDING", status: "DRAFT" },
    orderBy: { id: "asc" },
    take: needed * 3,
    select: { id: true, prompt: true, options: true, answerIndexes: true },
  });
  const ids = candidates.filter(isValidQuestion).slice(0, needed).map((question) => question.id);
  if (ids.length < needed) throw new Error(`有效待审题目不足：需要 ${needed} 道，找到 ${ids.length} 道`);
  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.updateMany({
      where: { id: { in: ids } },
      data: { reviewStatus: "APPROVED", status: "PUBLISHED", reviewedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        action: "quiz.question.publish-demo",
        method: "SCRIPT",
        path: "src/scripts/publish-demo-quiz.ts",
        targetType: "quiz_question",
        targetId: "bulk",
        detail: { ids: ids.map(String), purpose: "local-app-preview" },
      },
    });
  });
  console.log(`已校验并发布 ${ids.length} 道本地演示题，题库其余内容保持待审核。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
