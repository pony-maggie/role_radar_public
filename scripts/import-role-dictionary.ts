import { PrismaClient } from "@prisma/client";
import { importRoleDictionary } from "@/prisma/import-role-dictionary";

const prisma = new PrismaClient();

async function main() {
  const result = await importRoleDictionary(prisma);
  console.log(
    `Imported role dictionary snapshot ${result.source}: industries=${result.industries} roles=${result.roles}`
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
