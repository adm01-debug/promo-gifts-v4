#!/usr/bin/env node
/**
 * check-iframe-sandbox
 * --------------------------------------------------------------
 * Gate de CI: falha se algum `<iframe sandbox="...">` no código-
 * fonte contiver simultaneamente `allow-scripts` e `allow-same-
 * origin`. Essa combinação permite que o script dentro do iframe
 * escape do sandbox (acessa document.parent, remove o próprio
 * atributo sandbox e recarrega o frame sem restrição).
 *
 * Regra: MDN + Chromium/Firefox reforçam que a combinação é
 * insegura para conteúdo não-confiável.
 *
 * Como funciona:
 *   1. Percorre src/**\/*.{ts,tsx,js,jsx} (sem node_modules/dist/build).
 *   2. Para cada atributo `sandbox="..."` ou `sandbox={"..."}`,
 *      verifica se a lista de tokens inclui ambos os proibidos.
 *   3. Whitelist opcional em `.iframe-sandbox-allowlist.json`
 *      (array de `path:line` strings) para casos justificados.
 *   4. Saída: exit 0 se limpo; exit 1 imprimindo violações.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");
const ALLOWLIST_FILE = join(ROOT, ".iframe-sandbox-allowlist.json");

const FORBIDDEN = ["allow-scripts", "allow-same-origin"];
const EXT_RE = /\.(?:tsx?|jsx?)$/;
const IGNORE_DIRS = new Set(["node_modules", "dist", "build", ".next", "coverage"]);

/** Lê whitelist se existir; formato: string[] no shape "src/foo.tsx:123" */
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, "utf8"));
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (EXT_RE.test(entry)) yield full;
  }
}

/**
 * Extrai todos os valores de `sandbox="..."` ou `sandbox={"..."}`
 * de um trecho de código, com número da linha.
 * Retorna array de { line, value, raw }.
 */
function extractSandboxAttrs(source) {
  const results = [];
  // sandbox="valor" | sandbox='valor' | sandbox={"valor"} | sandbox={`valor`}
  const re = /sandbox\s*=\s*(?:{?\s*)?(["'`])([^"'`]*)\1/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const value = m[2];
    const line = source.slice(0, m.index).split("\n").length;
    results.push({ line, value, raw: m[0] });
  }
  return results;
}

function isUnsafe(sandboxValue) {
  const tokens = sandboxValue
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return FORBIDDEN.every((f) => tokens.includes(f));
}

function main() {
  if (!existsSync(SRC)) {
    console.log("⚠️  check-iframe-sandbox: src/ não existe — skip.");
    process.exit(0);
  }

  const allowlist = loadAllowlist();
  const violations = [];

  for (const file of walk(SRC)) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("sandbox")) continue;
    for (const attr of extractSandboxAttrs(src)) {
      if (!isUnsafe(attr.value)) continue;
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      const key = `${rel}:${attr.line}`;
      if (allowlist.has(key)) continue;
      violations.push({ file: rel, line: attr.line, value: attr.value });
    }
  }

  if (violations.length === 0) {
    console.log("✅ iframe sandbox gate: 0 violações");
    process.exit(0);
  }

  console.error(
    `❌ iframe sandbox gate: ${violations.length} violação(ões) detectada(s).`,
  );
  console.error(
    "   Combinação `allow-scripts` + `allow-same-origin` permite escape do sandbox.",
  );
  console.error("   Remova um dos dois tokens ou justifique em .iframe-sandbox-allowlist.json\n");
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}  sandbox="${v.value}"`);
  }
  process.exit(1);
}

main();
