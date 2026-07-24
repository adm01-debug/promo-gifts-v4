#!/usr/bin/env node
/**
 * SEO Sanity Check
 *
 * Garante que index.html tenha canonical / og:url / twitter:url corretos
 * apontando para promogifts.com.br e NUNCA para dominios de preview
 * (lovable.app, vercel.app, we-dream-big, criar-together-now).
 *
 * Roda como gate de CI antes do deploy em main.
 * Sai com codigo 1 se falhar - bloqueia o deploy.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const INDEX_PATH = resolve(process.cwd(), 'index.html');

if (!existsSync(INDEX_PATH)) {
  console.error('❌ index.html nao encontrado em', INDEX_PATH);
  process.exit(1);
}

const html = readFileSync(INDEX_PATH, 'utf-8');

const REQUIRED_DOMAIN = 'promogifts.com.br';
const FORBIDDEN_DOMAINS = [
  'lovable.app',
  'vercel.app',
  'we-dream-big',
  'criar-together-now',
];

// Tags que devem conter promogifts.com.br
const REQUIRED_TAGS = [
  { name: 'canonical', pattern: /<link\s+rel="canonical"\s+href="([^"]+)"/i },
  { name: 'og:url', pattern: /<meta\s+property="og:url"\s+content="([^"]+)"/i },
  { name: 'twitter:url', pattern: /<meta\s+name="twitter:url"\s+content="([^"]+)"/i },
];

let failed = false;

console.log('🔎 SEO Sanity Check em', INDEX_PATH);
console.log('');

// 1. Validar que tags obrigatorias existem e tem dominio correto
for (const tag of REQUIRED_TAGS) {
  const match = html.match(tag.pattern);
  if (!match) {
    console.error(`❌ Tag obrigatoria nao encontrada: ${tag.name}`);
    failed = true;
    continue;
  }
  const url = match[1];
  if (!url.includes(REQUIRED_DOMAIN)) {
    console.error(`❌ ${tag.name}: URL "${url}" nao contem "${REQUIRED_DOMAIN}"`);
    failed = true;
  } else {
    console.log(`✅ ${tag.name}: ${url}`);
  }
}

console.log('');

// 2. Validar que NENHUMA URL aponta para dominio proibido
for (const forbidden of FORBIDDEN_DOMAINS) {
  if (html.includes(forbidden)) {
    console.error(`❌ Dominio PROIBIDO encontrado: "${forbidden}"`);
    console.error(`   Index.html nao pode referenciar URLs de preview/staging.`);
    failed = true;
  } else {
    console.log(`✅ Sem referencias a "${forbidden}"`);
  }
}

console.log('');

if (failed) {
  console.error('❌ SEO Sanity Check FALHOU - corrija antes de fazer deploy');
  process.exit(1);
}

console.log('✅ SEO Sanity Check OK - libera deploy');
process.exit(0);
