#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const TEMPLATE_DIR = path.join(PACKAGE_ROOT, "templates", "worker");

function printHelp() {
  console.log(`ORGII Collaboration Hub

Usage:
  npx @orgii/collab-hub init <directory>

Commands:
  init <directory>  Create a deployable Cloudflare Worker hub project.

After init:
  cd <directory>
  npm install
  npx --yes wrangler@latest login
  npm run db:create
  npm run db:migrate
  npm run deploy
`);
}

function normalizeProjectName(targetDir) {
  return path.basename(path.resolve(targetDir)).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function updateTemplatePackageJson(targetDir) {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.name = normalizeProjectName(targetDir);
  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`
  );
}

function formatCdTarget(targetArg, targetDir) {
  return path.isAbsolute(targetArg) ? targetDir : targetArg;
}

function initProject(targetArg) {
  if (!targetArg) {
    throw new Error(
      "Missing target directory. Usage: npx @orgii/collab-hub init <directory>"
    );
  }

  const targetDir = path.resolve(process.cwd(), targetArg);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(TEMPLATE_DIR, targetDir, { recursive: true });
  updateTemplatePackageJson(targetDir);

  console.log(`Created ORGII Collaboration Hub project at ${targetDir}`);
  console.log(`
Next steps:
  cd ${formatCdTarget(targetArg, targetDir)}
  npm install
  npx --yes wrangler@latest login
  npm run db:create

Then paste the returned database_id into wrangler.jsonc and run:
  npm run db:migrate
  npm run deploy

After deploy, paste the Worker URL into ORGII > Add Org > Create Org.`);
}

try {
  const [command, targetDir] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command !== "init") {
    throw new Error(`Unknown command: ${command}`);
  }

  initProject(targetDir);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
