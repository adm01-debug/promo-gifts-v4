import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, cpSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BUMP = 'scripts/ssot-report-bump.mjs';

/**
 * O bumper opera em caminhos fixos (schemas/… + scripts/…). Para testar sem
 * mutar o repo, criamos uma sandbox espelho e rodamos o script com CWD nela.
 */
function makeSandbox(currentVersion = '2.0.0') {
  const dir = mkdtempSync(join(tmpdir(), 'ssot-bump-'));
  mkdirSync(join(dir, 'schemas'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });

  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: { schemaVersion: { type: 'string', const: currentVersion } },
    required: ['schemaVersion'],
  };
  writeFileSync(join(dir, 'schemas/ssot-report.schema.json'), JSON.stringify(schema, null, 2) + '\n');

  const emitter = `export const SCHEMA_VERSION = '${currentVersion}';\n`;
  writeFileSync(join(dir, 'scripts/ssot-report.mjs'), emitter);

  writeFileSync(
    join(dir, 'schemas/ssot-report.CHANGELOG.md'),
    `# SSOT Report — Changelog\n\n## ${currentVersion} — 2026-07-14\n\nBase.\n`,
  );

  // Copia o próprio bumper para dentro da sandbox para preservar caminhos relativos.
  cpSync(BUMP, join(dir, 'scripts/ssot-report-bump.mjs'));
  return dir;
}

function runBump(cwd: string, args: string[]) {
  return spawnSync('node', ['scripts/ssot-report-bump.mjs', ...args], { cwd, encoding: 'utf8' });
}

describe('ssot-report-bump — CLI', () => {
  let sandbox: string;
  beforeAll(() => {
    sandbox = makeSandbox('2.0.0');
  });

  it('exige --kind válido', () => {
    const r = runBump(sandbox, ['--reason=motivo suficiente']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--kind/);
  });

  it('exige --reason com pelo menos 8 caracteres', () => {
    const r = runBump(sandbox, ['--kind=patch', '--reason=curta']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--reason/);
  });

  it('rejeita --kind fora de major|minor|patch', () => {
    const r = runBump(sandbox, ['--kind=hotfix', '--reason=motivo suficiente aqui']);
    expect(r.status).toBe(1);
  });

  it('--dry retorna plano sem mutar arquivos', () => {
    const s0 = readFileSync(join(sandbox, 'schemas/ssot-report.schema.json'), 'utf8');
    const r = runBump(sandbox, ['--kind=minor', '--reason=adicionando gate opcional novo', '--dry']);
    expect(r.status).toBe(0);
    const plan = JSON.parse(r.stdout);
    expect(plan).toMatchObject({ dryRun: true, from: '2.0.0', to: '2.1.0', kind: 'minor' });
    const s1 = readFileSync(join(sandbox, 'schemas/ssot-report.schema.json'), 'utf8');
    expect(s1).toBe(s0);
  });

  it('aplica bump patch (2.0.0 → 2.0.1) e sincroniza schema + emitter + changelog', () => {
    const box = makeSandbox('2.0.0');
    const r = runBump(box, ['--kind=patch', '--reason=corrigindo descricao de campo']);
    expect(r.status).toBe(0);
    const schema = JSON.parse(readFileSync(join(box, 'schemas/ssot-report.schema.json'), 'utf8'));
    expect(schema.properties.schemaVersion.const).toBe('2.0.1');
    const emitter = readFileSync(join(box, 'scripts/ssot-report.mjs'), 'utf8');
    expect(emitter).toMatch(/SCHEMA_VERSION = '2\.0\.1'/);
    const changelog = readFileSync(join(box, 'schemas/ssot-report.CHANGELOG.md'), 'utf8');
    expect(changelog).toMatch(/## 2\.0\.1 —/);
    expect(changelog).toMatch(/corrigindo descricao de campo/);
    // Nova entrada deve vir antes da antiga.
    expect(changelog.indexOf('## 2.0.1')).toBeLessThan(changelog.indexOf('## 2.0.0'));
  });

  it('aplica bump minor (2.0.0 → 2.1.0)', () => {
    const box = makeSandbox('2.0.0');
    const r = runBump(box, ['--kind=minor', '--reason=novo campo opcional adicionado']);
    expect(r.status).toBe(0);
    const schema = JSON.parse(readFileSync(join(box, 'schemas/ssot-report.schema.json'), 'utf8'));
    expect(schema.properties.schemaVersion.const).toBe('2.1.0');
  });

  it('aplica bump major (2.0.0 → 3.0.0)', () => {
    const box = makeSandbox('2.0.0');
    const r = runBump(box, ['--kind=major', '--reason=remocao de campo details (breaking)']);
    expect(r.status).toBe(0);
    const schema = JSON.parse(readFileSync(join(box, 'schemas/ssot-report.schema.json'), 'utf8'));
    expect(schema.properties.schemaVersion.const).toBe('3.0.0');
  });

  it('falha quando schema e emitter estão dessincronizados', () => {
    const box = makeSandbox('2.0.0');
    // corrompe o emitter
    writeFileSync(join(box, 'scripts/ssot-report.mjs'), `export const SCHEMA_VERSION = '1.9.9';\n`);
    const r = runBump(box, ['--kind=patch', '--reason=tentativa em estado inconsistente']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Dessincronia/);
  });
});
