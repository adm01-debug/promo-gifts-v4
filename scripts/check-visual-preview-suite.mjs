#!/usr/bin/env node
/**
 * Guarda de presença: garante que a suíte de regressão visual do
 * botão Preview existe antes de qualquer execução de CI.
 *
 * Falha se QUALQUER um destes arquivos estiver ausente:
 *   - src/pages/__visual/PreviewButtonHarness.tsx
 *   - e2e/visual/preview-button.spec.ts
 *   - .github/workflows/e2e-visual-preview-button.yml
 *   - Registro da rota em src/routes/AppRoutes.tsx
 *
 * Motivação: a entrega anterior foi revertida silenciosamente
 * (provavelmente por re-geração do Lovable). Sem esta guarda, o CI
 * "passaria" rodando 0 specs e mascararia a perda de cobertura.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());

const REQUIRED_FILES = [
  'src/pages/__visual/PreviewButtonHarness.tsx',
  'e2e/visual/preview-button.spec.ts',
  '.github/workflows/e2e-visual-preview-button.yml',
];

const ROUTE_FILE = 'src/routes/AppRoutes.tsx';
const ROUTE_MARKERS = ['PreviewButtonHarness', '/__visual/preview-button'];

const missing = REQUIRED_FILES.filter((p) => !existsSync(resolve(ROOT, p)));

if (missing.length > 0) {
  console.error('\n❌ Suíte visual do botão Preview INCOMPLETA. Arquivos ausentes:');
  for (const f of missing) console.error(`   - ${f}`);
  console.error(
    '\nRe-gere a suíte (harness + spec + workflow) antes de subir o PR.\n',
  );
  process.exit(1);
}

const routeSrc = existsSync(resolve(ROOT, ROUTE_FILE))
  ? readFileSync(resolve(ROOT, ROUTE_FILE), 'utf8')
  : '';
const routeMissing = ROUTE_MARKERS.filter((m) => !routeSrc.includes(m));
if (routeMissing.length > 0) {
  console.error(`\n❌ ${ROUTE_FILE} não registra a rota visual. Marcadores ausentes:`);
  for (const m of routeMissing) console.error(`   - ${m}`);
  console.error('\nRe-aplique o registro <Route path="/__visual/preview-button" ...>.\n');
  process.exit(1);
}

console.log('✅ Suíte visual do botão Preview presente e registrada.');
