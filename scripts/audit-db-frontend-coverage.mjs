#!/usr/bin/env node
/**
 * Auditoria DB ↔ Frontend (coluna a coluna)
 *
 * Cruza o schema dos 3 bancos (Interno via psql, Externo e CRM via tipos do repo)
 * com o uso real no código (src/, supabase/functions/, api/) e emite:
 *
 *   - docs/DB_FRONTEND_COVERAGE.md   (relatório legível)
 *   - audit/db-frontend-coverage.json (snapshot para diff)
 *
 * Uso:
 *   node scripts/audit-db-frontend-coverage.mjs
 *
 * Pré-requisitos:
 *   - psql disponível e variáveis PG* exportadas (BD interno)
 *   - ripgrep (rg) no PATH
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ──────────────────────────────────────────────────────────────────────────────
// Configuração
// ──────────────────────────────────────────────────────────────────────────────

// "api/" não existe neste repo hoje; filtrar para diretórios presentes evita
// que o rg aborte com "No such file or directory" e derrube a auditoria.
const SEARCH_DIRS = ["src", "supabase/functions", "api"].filter((d) =>
  existsSync(resolve(ROOT, d))
);

const EXCLUDED_TABLE_PATTERNS = [
  /_old$/,
  /_y\d{4}m\d{2}$/,
  /_backup$/,
  /_tmp$/,
  /^pg_/,
];

const SYSTEM_COLUMNS = new Set([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "tenant_id",
]);

// Mapeamento tabela → módulo funcional (para agrupar no relatório).
// Padrões testados em ordem; primeiro match vence; default = "Outros".
const MODULE_MAP = [
  [/^quote/, "Orçamentos"],
  [/^order/, "Pedidos"],
  [/^favorite/, "Favoritos"],
  [/^collection/, "Coleções"],
  [/^kit|^cart_templates|^cart/, "Kits & Carrinhos"],
  [/^seller_/, "Carrinhos de Vendedor"],
  [/^mcp|^step_up|^mfa/, "MCP & Step-Up"],
  [/^magic_up/, "Magic Up"],
  [/^mockup/, "Mockups"],
  [/^profile|^user_|^role|^permission|^organization/, "Usuários & RBAC"],
  [/^admin_audit|^audit|^rls_denial|^conversation_audit/, "Auditoria"],
  [/^webhook|^outbound_|^inbound_|^connection_/, "Webhooks & Conexões"],
  [/^ai_|^expert_/, "IA & Flow"],
  [/^product|^variant|^categor|^tag|^color_|^material_/, "Catálogo / Produtos"],
  [/^stock|^replenish|^optim/, "Estoque"],
  [/^price|^tabela_preco|^discount/, "Preços & Descontos"],
  [/^seo|^trend|^search_/, "SEO & Busca"],
  [/^ip_|^geo_|^bot_|^anti_|^public_token|^file_scan|^auth_|^login/, "Segurança"],
  [/^scheduled_|^request_rate|^secret_rotation|^hardening|^app_vitals|^query_telemetry|^workspace_notif/, "Infra & Observabilidade"],
  [/^integration_credentials|^external_connections/, "Integrações"],
  [/^companies|^contacts|^company_/, "CRM"],
  [/^simulator_|^saved_/, "Simulador & Filtros"],
];

function moduleOf(table) {
  for (const [rx, name] of MODULE_MAP) if (rx.test(table)) return name;
  return "Outros";
}

function isExcluded(table) {
  return EXCLUDED_TABLE_PATTERNS.some((rx) => rx.test(table));
}

function camelize(snake) {
  return snake.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────────────
// Coleta de schemas
// ──────────────────────────────────────────────────────────────────────────────

function fetchInternalSchema() {
  try {
    const out = execSync(
      `psql -At -F $'\\t' -c "
        SELECT c.table_name, c.column_name, c.data_type,
               COALESCE(s.n_live_tup, 0) AS rows
        FROM information_schema.columns c
        LEFT JOIN pg_stat_user_tables s
          ON s.relname = c.table_name AND s.schemaname = 'public'
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
      "`,
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    const tables = new Map();
    for (const line of out.trim().split("\n")) {
      const [table, col, type, rows] = line.split("\t");
      if (!tables.has(table)) {
        tables.set(table, { rows: Number(rows) || 0, columns: [] });
      }
      tables.get(table).columns.push({ name: col, type });
    }
    return tables;
  } catch (err) {
    console.warn("⚠️  Não consegui ler BD interno via psql:", err.message);
    return new Map();
  }
}

// Extrai interfaces TypeScript de um arquivo: { InterfaceName: [col, ...] }
function parseTsInterfaces(filePath) {
  const interfaces = {};
  if (!existsSync(filePath)) return interfaces;
  const src = readFileSync(filePath, "utf8");
  const rxIface = /export\s+interface\s+(\w+)\s*(?:extends[^{]+)?\{([^}]*)\}/gs;
  let m;
  while ((m = rxIface.exec(src)) !== null) {
    const [, name, body] = m;
    const cols = [];
    for (const line of body.split("\n")) {
      const cm = line.match(/^\s*([a-z_][a-zA-Z0-9_]*)\??\s*:/);
      if (cm && cm[1] !== "constructor") cols.push(cm[1]);
    }
    if (cols.length) interfaces[name] = cols;
  }
  return interfaces;
}

// Mapeia interfaces conhecidas → nome de tabela
const EXTERNAL_TYPE_MAP = {
  "src/types/external-db.ts": {
    ExternalProduct: "products",
    ExternalTechnique: "tecnicas_gravacao",
    ExternalPrintArea: "print_areas",
  },
  "src/types/product-catalog.ts": {
    Product: "products",
    ProductColor: "product_colors_view",
  },
  "src/types/product.ts": { Product: "products" },
  "src/types/stock.ts": {
    StockItem: "stock_levels",
    StockMovement: "stock_movements",
  },
  "src/types/gravacao-database.ts": {
    TabelaPrecoGravacaoOficial: "tabela_preco_gravacao_oficial",
    TabelaPrecoGravacaoOficialFaixa: "tabela_preco_gravacao_oficial_faixa",
  },
};

const CRM_TYPE_MAP = {
  "src/types/crm.ts": {
    CrmCompany: "companies",
    CrmContact: "contacts",
    CrmContactEmail: "contact_emails",
    CrmContactPhone: "contact_phones",
    CrmAddress: "company_addresses",
  },
};

function fetchSchemaFromTypes(map) {
  const tables = new Map();
  for (const [file, ifaceMap] of Object.entries(map)) {
    const fp = resolve(ROOT, file);
    const ifaces = parseTsInterfaces(fp);
    for (const [iface, tbl] of Object.entries(ifaceMap)) {
      const cols = ifaces[iface];
      if (!cols) continue;
      if (!tables.has(tbl)) tables.set(tbl, { rows: -1, columns: [] });
      const t = tables.get(tbl);
      for (const c of cols) {
        if (!t.columns.find((x) => x.name === c)) {
          t.columns.push({ name: c, type: "unknown" });
        }
      }
    }
  }
  return tables;
}

// ──────────────────────────────────────────────────────────────────────────────
// Indexação de uso no código
// ──────────────────────────────────────────────────────────────────────────────

function indexCodeUsage() {
  const files = execSync(
    `rg --files ${SEARCH_DIRS.join(" ")} -g '*.{ts,tsx,js,mjs}' -g '!node_modules' -g '!dist' -g '!.next'`,
    { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  // Indexa por arquivo: conteúdo + conjunto de "select strings" + lista de tabelas mencionadas
  const perFile = [];
  let bigBlob = "";
  for (const f of files) {
    try {
      const src = readFileSync(resolve(ROOT, f), "utf8");
      bigBlob += "\n" + src;
      const selectStrings = [];
      const reSel = /\.select\(\s*["'`]([^"'`)]+)["'`]/g;
      let m;
      while ((m = reSel.exec(src)) !== null) selectStrings.push(m[1]);
      const insertUpdate = [];
      const reIU = /\.(?:insert|update|upsert)\(\s*\{([^}]{0,2000})\}/g;
      while ((m = reIU.exec(src)) !== null) insertUpdate.push(m[1]);
      const tablesMentioned = new Set();
      const reTbl = /(?:from|table)\s*\(\s*["'`]([a-z_][a-z0-9_]*)["'`]|["']table["']\s*:\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi;
      while ((m = reTbl.exec(src)) !== null) tablesMentioned.add(m[1] || m[2]);
      perFile.push({ src, selectStrings, insertUpdate, tablesMentioned });
    } catch {}
  }
  return { perFile, bigBlob };
}

function detectUsage(index, table, column) {
  const snake = column;
  const camel = camelize(column);
  const variants = snake === camel ? [snake] : [snake, camel];

  let read = false;
  let write = false;

  // Conjunto de arquivos que mencionam esta tabela
  const filesForTable = index.perFile.filter((f) => f.tablesMentioned.has(table));

  for (const name of variants) {
    const wordRe = new RegExp(`\\b${name}\\b`);

    // READ #1: aparece dentro de uma string .select('...')
    for (const f of index.perFile) {
      if (f.selectStrings.some((s) => wordRe.test(s))) { read = true; break; }
    }

    // READ #2: arquivo menciona a tabela E referencia .col / col: / "col"
    if (!read) {
      for (const f of filesForTable) {
        const acc = new RegExp(`\\.${name}\\b(?![A-Za-z0-9_])|["']${name}["']\\s*:|\\b${name}\\s*:`).test(f.src);
        if (acc) { read = true; break; }
      }
    }

    // WRITE: dentro de bloco insert/update/upsert num arquivo que menciona a tabela
    if (!write) {
      for (const f of filesForTable) {
        if (f.insertUpdate.some((body) => wordRe.test(body))) { write = true; break; }
      }
    }
  }
  return { read, write };
}

function tableUsedAtAll(index, table) {
  return index.perFile.some((f) => f.tablesMentioned.has(table));
}

// ──────────────────────────────────────────────────────────────────────────────
// Análise principal
// ──────────────────────────────────────────────────────────────────────────────

function analyzeDb(label, tables, blob, opts = {}) {
  const { skipEmpty = false } = opts;
  const results = [];

  for (const [table, info] of tables) {
    if (isExcluded(table)) {
      results.push({ table, excluded: "name-pattern", rows: info.rows });
      continue;
    }
    if (skipEmpty && info.rows === 0) {
      results.push({ table, excluded: "empty", rows: 0 });
      continue;
    }

    const tableSeen = tableUsedAtAll(blob, table);
    const cols = info.columns.map((c) => {
      if (SYSTEM_COLUMNS.has(c.name)) {
        return { ...c, status: "SYSTEM" };
      }
      const { read, write } = detectUsage(blob, table, c.name);
      let status = "ORPHAN";
      if (read && write) status = "READ+WRITE";
      else if (read) status = "READ";
      else if (write) status = "WRITE";
      return { ...c, status };
    });

    const orphans = cols.filter((c) => c.status === "ORPHAN");
    const used = cols.filter((c) =>
      ["READ", "WRITE", "READ+WRITE"].includes(c.status)
    );

    results.push({
      table,
      module: moduleOf(table),
      rows: info.rows,
      tableSeen,
      columns: cols,
      coverage:
        cols.length === 0
          ? 0
          : Math.round((used.length / (cols.length - cols.filter((c) => c.status === "SYSTEM").length || 1)) * 100),
      orphanCount: orphans.length,
      totalCount: cols.length,
    });
  }
  return { label, tables: results };
}

// ──────────────────────────────────────────────────────────────────────────────
// Relatório markdown
// ──────────────────────────────────────────────────────────────────────────────

function renderMarkdown(reports) {
  const lines = [];
  lines.push("# DB ↔ Frontend Coverage Report");
  lines.push("");
  lines.push(`_Gerado em ${new Date().toISOString()} por \`scripts/audit-db-frontend-coverage.mjs\`._`);
  lines.push("");
  lines.push("> **Como ler:** para cada coluna, classificamos como `READ`, `WRITE`, `READ+WRITE`, `ORPHAN` ou `SYSTEM`. `ORPHAN` = não encontramos referência no código (`src/`, `supabase/functions/`, `api/`). Pode ser falso-positivo se for usada apenas por triggers/RPCs.");
  lines.push("");

  // Sumário
  lines.push("## Sumário executivo");
  lines.push("");
  lines.push("| Banco | Tabelas analisadas | Tabelas excluídas | Colunas | Órfãs | Cobertura média |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const r of reports) {
    const analyzed = r.tables.filter((t) => !t.excluded);
    const excluded = r.tables.filter((t) => t.excluded);
    const totalCols = analyzed.reduce((s, t) => s + (t.totalCount || 0), 0);
    const totalOrphans = analyzed.reduce((s, t) => s + (t.orphanCount || 0), 0);
    const avgCov = analyzed.length
      ? Math.round(analyzed.reduce((s, t) => s + (t.coverage || 0), 0) / analyzed.length)
      : 0;
    lines.push(
      `| ${r.label} | ${analyzed.length} | ${excluded.length} | ${totalCols} | ${totalOrphans} | ${avgCov}% |`
    );
  }
  lines.push("");

  // Top tabelas com mais órfãs (geral)
  const allAnalyzed = reports.flatMap((r) =>
    r.tables.filter((t) => !t.excluded).map((t) => ({ ...t, db: r.label }))
  );
  const topOrphans = [...allAnalyzed]
    .sort((a, b) => b.orphanCount - a.orphanCount)
    .slice(0, 20);
  lines.push("## Top 20 tabelas com mais colunas órfãs");
  lines.push("");
  lines.push("| Banco | Tabela | Módulo | Órfãs | Total | Cob. | Rows |");
  lines.push("|---|---|---|---:|---:|---:|---:|");
  for (const t of topOrphans) {
    lines.push(
      `| ${t.db} | \`${t.table}\` | ${t.module} | ${t.orphanCount} | ${t.totalCount} | ${t.coverage}% | ${t.rows < 0 ? "—" : t.rows} |`
    );
  }
  lines.push("");

  // Por banco e módulo
  for (const r of reports) {
    lines.push(`## ${r.label}`);
    lines.push("");

    const analyzed = r.tables.filter((t) => !t.excluded);

    // Agrupa por módulo
    const byModule = new Map();
    for (const t of analyzed) {
      if (!byModule.has(t.module)) byModule.set(t.module, []);
      byModule.get(t.module).push(t);
    }

    for (const [mod, tabs] of [...byModule.entries()].sort()) {
      lines.push(`### ${mod}`);
      lines.push("");
      for (const t of tabs.sort((a, b) => a.table.localeCompare(b.table))) {
        const tableLink = t.tableSeen ? "" : " 🚫 _(tabela não referenciada no código)_";
        lines.push(
          `<details><summary><code>${t.table}</code> — ${t.coverage}% cobertura, ${t.orphanCount}/${t.totalCount} órfãs, rows: ${t.rows < 0 ? "—" : t.rows}${tableLink}</summary>`
        );
        lines.push("");
        lines.push("| Coluna | Tipo | Status |");
        lines.push("|---|---|---|");
        for (const c of t.columns) {
          lines.push(`| \`${c.name}\` | ${c.type} | ${c.status} |`);
        }
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
    }

    // Tabelas excluídas
    const excluded = r.tables.filter((t) => t.excluded);
    if (excluded.length) {
      lines.push("### Tabelas excluídas");
      lines.push("");
      lines.push("| Tabela | Motivo | Rows |");
      lines.push("|---|---|---:|");
      for (const t of excluded.sort((a, b) => a.table.localeCompare(b.table))) {
        lines.push(`| \`${t.table}\` | ${t.excluded} | ${t.rows} |`);
      }
      lines.push("");
    }
  }

  // Avisos
  lines.push("## Avisos / falsos-positivos esperados");
  lines.push("");
  lines.push("- **Colunas usadas só por triggers ou RPCs** aparecem como `ORPHAN`. Confira `pg_proc`/`information_schema.routines` antes de remover.");
  lines.push("- **Edge functions internas (cron, webhooks)** podem escrever sem exposição no front — `WRITE` sem `READ` é normal nesses casos.");
  lines.push("- **External DB e CRM** foram inferidos a partir dos tipos TS do repo (`src/types/*.ts`); colunas existentes no BD remoto mas ausentes do tipo NÃO aparecem aqui. Para cobertura 100%, adicione operação `introspect` aos bridges.");
  lines.push("- **`rows`** reflete o ambiente onde o script rodou. Em sandbox tipicamente é 0; em produção use `npm run audit:db-frontend` no contexto correto.");
  lines.push("");

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

function main() {
  console.log("→ Indexando código…");
  const blob = indexCodeUsage();
  console.log(`  ${blob.perFile.length} arquivos, ${(blob.bigBlob.length / 1024 / 1024).toFixed(1)} MB`);

  console.log("→ Schema BD interno (psql)…");
  const internal = fetchInternalSchema();
  console.log(`  ${internal.size} tabelas`);

  console.log("→ Schema BD externo (tipos TS)…");
  const external = fetchSchemaFromTypes(EXTERNAL_TYPE_MAP);
  console.log(`  ${external.size} tabelas`);

  console.log("→ Schema CRM (tipos TS)…");
  const crm = fetchSchemaFromTypes(CRM_TYPE_MAP);
  console.log(`  ${crm.size} tabelas`);

  console.log("→ Análise…");
  const reports = [
    analyzeDb("BD Interno (app)", internal, blob, { skipEmpty: false }),
    analyzeDb("BD Externo (produtos SSOT)", external, blob),
    analyzeDb("BD CRM (Bitrix mirror)", crm, blob),
  ];

  const md = renderMarkdown(reports);
  mkdirSync(resolve(ROOT, "docs"), { recursive: true });
  mkdirSync(resolve(ROOT, "audit"), { recursive: true });
  writeFileSync(resolve(ROOT, "docs/DB_FRONTEND_COVERAGE.md"), md);
  writeFileSync(
    resolve(ROOT, "audit/db-frontend-coverage.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)
  );

  // Resumo no console
  for (const r of reports) {
    const analyzed = r.tables.filter((t) => !t.excluded);
    const orphans = analyzed.reduce((s, t) => s + (t.orphanCount || 0), 0);
    const cols = analyzed.reduce((s, t) => s + (t.totalCount || 0), 0);
    console.log(`  ${r.label}: ${analyzed.length} tabelas, ${cols} colunas, ${orphans} órfãs`);
  }
  console.log("\n✅ docs/DB_FRONTEND_COVERAGE.md");
  console.log("✅ audit/db-frontend-coverage.json");
}

main();
