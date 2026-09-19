import "dotenv/config";
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();
const categoryCode = process.argv[2];

async function main() {
  const category = categoryCode
    ? await prisma.quizCategory.findUniqueOrThrow({where: {code: categoryCode}})
    : undefined;
  const groups = await prisma.quizQuestion.groupBy({
    by: ["status", "reviewStatus"],
    where: category ? {categoryId: category.id} : undefined,
    _count: true,
  });
  console.log(JSON.stringify({
    category: category ? {code: category.code, name: category.name} : "all",
    total: groups.reduce((sum, group) => sum + group._count, 0),
    groups,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
