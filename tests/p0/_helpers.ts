/**
 * Helpers estruturais para testes P0.
 *
 * Convertem expectativas "vai existir uma policy/função/edge function que faça X"
 * em asserções concretas contra arquivos do repositório, sem depender de banco
 * de dados rodando. Complementam os mocks de fetch (`_mocks.ts`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname ?? __dirname, "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");

let _migrationsCache: string | null = null;

/** Concatenação de todos os arquivos .sql em supabase/migrations/. Cache em memória. */
export function readAllMigrations(): string {
  if (_migrationsCache !== null) return _migrationsCache;
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const parts: string[] = [];
  for (const f of files) {
    parts.push(`-- FILE: ${f}\n`);
    parts.push(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    parts.push("\n");
  }
  _migrationsCache = parts.join("");
  return _migrationsCache;
}

/** Verifica que existe pelo menos uma policy/migration que cita o padrão. */
export function migrationsInclude(pattern: RegExp): boolean {
  return pattern.test(readAllMigrations());
}

/** Conta quantas vezes o padrão aparece. */
export function migrationsMatchCount(pattern: RegExp): number {
  const all = readAllMigrations();
  return (all.match(pattern) ?? []).length;
}

/** Verifica que uma edge function existe no diretório supabase/functions/. */
export function edgeFunctionExists(name: string): boolean {
  const dir = join(FUNCTIONS_DIR, name);
  return existsSync(dir) && statSync(dir).isDirectory();
}

/** Lê o index.ts de uma edge function (string vazia se não existir). */
export function readEdgeFunctionSource(name: string): string {
  const file = join(FUNCTIONS_DIR, name, "index.ts");
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

/**
 * Verifica que uma edge function tem verify_jwt configurado no config.toml.
 * Retorna true se a função NÃO está listada (default = verify_jwt=true) OU
 * se está listada com verify_jwt=true. Retorna false se está listada com false.
 */
export function edgeFunctionRequiresJwt(name: string): boolean {
  const configPath = join(ROOT, "supabase", "config.toml");
  if (!existsSync(configPath)) return true; // assume default
  const cfg = readFileSync(configPath, "utf8");
  const section = new RegExp(`\\[functions\\.${name}\\]([^\\[]*)`, "i");
  const match = cfg.match(section);
  if (!match) return true; // sem entrada = default verify_jwt=true
  return !/verify_jwt\s*=\s*false/i.test(match[1]);
}
