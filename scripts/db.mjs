import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "db/migrations";
const LEDGER = "db/supabase/migrations";
const PROJECT_REF = "bwwgwczwwojkboobwxyo";
const FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function listSource() {
  if (!existsSync(SOURCE)) return [];
  const entries = [];
  for (const domain of readdirSync(SOURCE)) {
    const dir = join(SOURCE, domain);
    if (!statSync(dir).isDirectory()) continue;
    if (!NAME_PATTERN.test(domain)) fail(`Domínio inválido: ${domain}`);
    for (const file of readdirSync(dir)) {
      const match = FILE_PATTERN.exec(file);
      if (!match) fail(`Nome inválido em ${domain}/${file}. Use <14 dígitos>_<acao>.sql`);
      entries.push({ domain, file, version: match[1], action: match[2], path: join(dir, file) });
    }
  }
  entries.sort((a, b) => a.version.localeCompare(b.version));
  const seen = new Map();
  for (const entry of entries) {
    const key = `${entry.domain}/${entry.file}`;
    if (seen.has(entry.version)) fail(`Versão duplicada ${entry.version}: ${seen.get(entry.version)} e ${key}`);
    seen.set(entry.version, key);
  }
  return entries;
}

function sync() {
  const entries = listSource();
  rmSync(LEDGER, { recursive: true, force: true });
  mkdirSync(LEDGER, { recursive: true });
  for (const entry of entries) {
    cpSync(entry.path, join(LEDGER, `${entry.version}_${entry.domain}_${entry.action}.sql`));
  }
  console.log(`db:sync ${entries.length} migração(ões) em ${LEDGER}`);
}

function supabase(args, { capture = false } = {}) {
  const result = spawnSync("npx", ["supabase", "--workdir", "db", ...args], {
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    shell: true,
    encoding: "utf8",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

function version() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "sync":
    sync();
    break;
  case "new": {
    const [domain, action] = rest;
    if (!domain || !action || !NAME_PATTERN.test(domain) || !NAME_PATTERN.test(action)) {
      fail("Uso: npm run db:new -- <dominio> <acao>");
    }
    const dir = join(SOURCE, domain);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${version()}_${action}.sql`);
    writeFileSync(path, "");
    console.log(path);
    break;
  }
  case "push":
    sync();
    supabase(["db", "push", ...rest]);
    break;
  case "status":
    sync();
    supabase(["migration", "list"]);
    break;
  case "pull": {
    const [domain = "misc"] = rest;
    sync();
    const before = new Set(readdirSync(LEDGER));
    supabase(["db", "pull"]);
    for (const file of readdirSync(LEDGER)) {
      const match = FILE_PATTERN.exec(file);
      if (before.has(file) || !match) continue;
      const dir = join(SOURCE, domain);
      mkdirSync(dir, { recursive: true });
      const target = join(dir, `${match[1]}_${match[2]}.sql`);
      cpSync(join(LEDGER, file), target);
      console.log(`nova migração em ${target}`);
    }
    break;
  }
  case "types": {
    const output = supabase(["gen", "types", "typescript", "--linked"], { capture: true });
    writeFileSync("src/types/database.ts", output);
    console.log("src/types/database.ts atualizado");
    break;
  }
  case "link":
    supabase(["link", "--project-ref", PROJECT_REF]);
    break;
  case "config-push":
    supabase(["config", "push"]);
    break;
  default:
    fail("Comandos: sync, new, push, pull, status, types, link, config-push");
}
