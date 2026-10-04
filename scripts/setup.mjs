// One-time local setup: env files → Prisma client → schema push → Northstar seed.
//   pnpm setup:local
import { copyFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const copies = [
  ["apps/web/.env.example", "apps/web/.env.local"],
  ["packages/database/.env.example", "packages/database/.env"],
];
for (const [from, to] of copies) {
  if (!existsSync(to)) {
    copyFileSync(from, to);
    console.log(`created ${to}`);
  }
}

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};
run("pnpm --filter @contextos/database db:generate");
run("pnpm --filter @contextos/database db:push");
run("pnpm --filter @contextos/database db:seed");
console.log("\nDone. Start everything with: pnpm dev");
