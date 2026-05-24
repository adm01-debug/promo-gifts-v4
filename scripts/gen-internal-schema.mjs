#!/usr/bin/env node
/**
 * gen-internal-schema.mjs
 * ------------------------------------------------------------------------
 * Regenera `audit/internal-schema.tsv` a partir do estado migrado atual do
 * banco (schema `public`). Resolve o TODO histórico do repo: antes deste
 * script o TSV era mantido à mão (commit único "Changes"), o que o deixava
 * desatualizado e parcial. Agora é um artefato reproduzível.
 *
 * Formato de saída (TSV, 4 colunas, sem cabeçalho):
 *   <tabela>\t<coluna>\t<tipo>\t<flag>
 *
 * - Escopo: TODAS as tabelas BASE do schema `public` (pg_class.relkind='r').
 *   Views são intencionalmente excluídas (são derivadas das tabelas base).
 * - Ordenação: por nome de tabela e, dentro de cada tabela, pela
 *   ordinal_position da coluna (ordem física de definição).
 * - 4ª coluna (`flag`): campo reservado, emitido como 0. No artefato manual
 *   anterior essa coluna não tinha semântica documentada (era 0 em ~99,5%
 *   das linhas); aqui é padronizada em 0 até que um significado seja
 *   formalmente definido. NÃO altere para um valor derivado sem atualizar
 *   também os consumidores do arquivo.
 *
 * Uso:
 *   DATABASE_URL=postgresql://USER:PASS@HOST:PORT/postgres \
 *     node scripts/gen-internal-schema.mjs
 *
 * Requer a devDependency `pg`:
 *   npm i -D pg
 *
 * Saída: escreve em audit/internal-schema.tsv (relativo à raiz do repo) e
 * imprime no stderr o total de tabelas/colunas para conferência.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERRO: defina a variável de ambiente DATABASE_URL.');
  process.exit(1);
}

const SQL = `
  SELECT c.table_name,
         c.column_name,
         c.data_type
  FROM information_schema.columns c
  JOIN pg_class      cl ON cl.relname = c.table_name
  JOIN pg_namespace  ns ON ns.oid = cl.relnamespace
  WHERE c.table_schema = 'public'
    AND ns.nspname = 'public'
    AND cl.relkind = 'r'           -- apenas tabelas base
  ORDER BY c.table_name, c.ordinal_position
`;

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

let rows;
try {
  ({ rows } = await client.query(SQL));
} finally {
  await client.end();
}

const FLAG = '0'; // campo reservado — ver cabeçalho
const lines = rows.map(r => `${r.table_name}\t${r.column_name}\t${r.data_type}\t${FLAG}`);
const tsv = lines.join('\n') + '\n';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '..', 'audit', 'internal-schema.tsv');
writeFileSync(outPath, tsv);

const tableCount = new Set(rows.map(r => r.table_name)).size;
console.error(`internal-schema.tsv regenerado: ${tableCount} tabelas, ${rows.length} colunas -> ${outPath}`);
