#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'coverage', 'ci');
fs.mkdirSync(outDir, { recursive: true });

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, TZ: 'America/Sao_Paulo' } });
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const pct = (covered, total) => (total === 0 ? 100 : Math.round((covered / total) * 1000) / 10);

function summarizeVitest(summaryPath) {
  const summary = readJson(summaryPath);
  const total = summary.total;
  return {
    lines: pct(total.lines.covered, total.lines.total),
    functions: pct(total.functions.covered, total.functions.total),
    branches: pct(total.branches.covered, total.branches.total),
    statements: pct(total.statements.covered, total.statements.total),
    raw: total,
  };
}

function summarizePlaywright(reportPath) {
  const report = readJson(reportPath);
  const modules = new Map();
  let total = 0;
  let passed = 0;

  const walkSuites = (suite, ancestors = []) => {
    const nextAncestors = [...ancestors, suite.title].filter(Boolean);
    for (const spec of suite.specs || []) {
      const relFile = spec.file ? path.relative(root, spec.file) : nextAncestors.join(' > ');
      const module = relFile.startsWith('e2e/routes/')
        ? relFile.split('/').slice(0, 3).join('/')
        : relFile.startsWith('e2e/flows/')
          ? relFile.split('/').slice(0, 3).join('/')
          : relFile.split('/').slice(0, 2).join('/');
      const entry = modules.get(module) || { total: 0, passed: 0 };
      for (const test of spec.tests || []) {
        entry.total += 1;
        total += 1;
        const ok = (test.results || []).some((r) => r.status === 'passed');
        if (ok) {
          entry.passed += 1;
          passed += 1;
        }
      }
      modules.set(module, entry);
    }
    for (const child of suite.suites || []) walkSuites(child, nextAncestors);
  };

  for (const suite of report.suites || []) walkSuites(suite);

  const perModule = Object.fromEntries(
    [...modules.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => [name, {
      total: data.total,
      passed: data.passed,
      coverage_percent: pct(data.passed, data.total),
    }]),
  );

  return {
    scenario_pass_percent: pct(passed, total),
    total,
    passed,
    modules: perModule,
  };
}

if (!process.argv.includes('--skip-run')) {
  run('npx vitest run tests tests/components tests/hooks tests/lib tests/utils --coverage --coverage.reporter=json-summary --coverage.reporter=text --coverage.reportsDirectory=coverage/ci/unit --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0');
  run('npx vitest run tests/integration tests/edge-functions/integration --coverage --coverage.reporter=json-summary --coverage.reporter=text --coverage.reportsDirectory=coverage/ci/integration --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0');
  run('npx playwright test --reporter=json --output=playwright-report-ci > coverage/ci/e2e-report.json');
}

const unitSummaryPath = path.join(outDir, 'unit', 'coverage-summary.json');
const integrationSummaryPath = path.join(outDir, 'integration', 'coverage-summary.json');
const e2eSummaryPath = path.join(outDir, 'e2e-report.json');

for (const required of [unitSummaryPath, integrationSummaryPath, e2eSummaryPath]) {
  if (!fs.existsSync(required)) {
    console.error(`❌ Arquivo obrigatório ausente: ${required}`);
    console.error('   Execute `npm run coverage:ci:collect` para gerar os artefatos primeiro.');
    process.exit(1);
  }
}

const unit = summarizeVitest(unitSummaryPath);
const integration = summarizeVitest(integrationSummaryPath);
const e2e = summarizePlaywright(e2eSummaryPath);

const consolidated = {
  generated_at: new Date().toISOString(),
  package: process.env.npm_package_name || null,
  suites: { unit, integration, e2e },
};

fs.writeFileSync(path.join(outDir, 'coverage-consolidated.json'), JSON.stringify(consolidated, null, 2));

const md = [
  '# Cobertura Consolidada (Unit + Integration + E2E)',
  '',
  `Gerado em: ${consolidated.generated_at}`,
  '',
  '## Resumo',
  '',
  '| Suite | Lines | Functions | Branches | Statements |',
  '|---|---:|---:|---:|---:|',
  `| Unit | ${unit.lines}% | ${unit.functions}% | ${unit.branches}% | ${unit.statements}% |`,
  `| Integration | ${integration.lines}% | ${integration.functions}% | ${integration.branches}% | ${integration.statements}% |`,
  `| E2E (cenários aprovados) | ${e2e.scenario_pass_percent}% | - | - | - |`,
  '',
  '## E2E por pacote/módulo',
  '',
  '| Módulo | Cenários aprovados | Cenários totais | % |',
  '|---|---:|---:|---:|',
  ...Object.entries(e2e.modules).map(([mod, data]) => `| ${mod} | ${data.passed} | ${data.total} | ${data.coverage_percent}% |`),
  '',
].join('\n');

fs.writeFileSync(path.join(outDir, 'coverage-consolidated.md'), md);
console.log(`\n✅ Consolidado gerado em ${outDir}`);
