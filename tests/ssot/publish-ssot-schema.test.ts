import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

const SRC = 'schemas/ssot-report.schema.json';
const OUT = 'public/schemas';
const LATEST = `${OUT}/ssot-report.schema.json`;
const INDEX = `${OUT}/versions.json`;

function run(args: string[] = []) {
  return spawnSync('node', ['scripts/publish-ssot-schema.mjs', ...args], { encoding: 'utf8' });
}

describe('publish-ssot-schema — endpoint público', () => {
  it('gate --check passa após publicação (baseline verde)', () => {
    // Publica primeiro para estabelecer estado consistente.
    const pub = run();
    expect(pub.status).toBe(0);
    const chk = run(['--check']);
    expect(chk.status).toBe(0);
  });

  it('espelho publicado inclui $id canônico e x-published.version', () => {
    run();
    const published = JSON.parse(readFileSync(LATEST, 'utf8'));
    expect(published.$id).toMatch(/^https:\/\/promogifts\.com\.br\/schemas\/ssot-report\.schema\.json$/);
    expect(published['x-published']?.version).toBe(published.properties.schemaVersion.const);
    expect(Array.isArray(published['x-published']?.endpoints)).toBe(true);
    expect(published['x-published'].endpoints.length).toBeGreaterThanOrEqual(1);
  });

  it('gera snapshot imutável ssot-report.v<X.Y.Z>.schema.json coincidente', () => {
    run();
    const src = JSON.parse(readFileSync(SRC, 'utf8'));
    const version = src.properties.schemaVersion.const;
    const versioned = `${OUT}/ssot-report.v${version}.schema.json`;
    expect(existsSync(versioned)).toBe(true);
    expect(readFileSync(versioned, 'utf8')).toBe(readFileSync(LATEST, 'utf8'));
  });

  it('versions.json aponta latest correto e lista o snapshot atual', () => {
    run();
    const src = JSON.parse(readFileSync(SRC, 'utf8'));
    const version = src.properties.schemaVersion.const;
    const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
    expect(idx.latest).toBe(version);
    expect(idx.latestPath).toBe('/schemas/ssot-report.schema.json');
    expect(idx.versions.find((v: { version: string }) => v.version === version)?.path).toBe(
      `/schemas/ssot-report.v${version}.schema.json`,
    );
    expect(idx.canonical).toMatch(/^https:\/\//);
    expect(Array.isArray(idx.endpoints)).toBe(true);
  });

  it('vercel.json declara headers CORS + content-type para os endpoints', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const sources = vercel.headers.map((h: { source: string }) => h.source);
    expect(sources).toContain('/schemas/ssot-report.schema.json');
    expect(sources).toContain('/schemas/versions.json');
    const latestEntry = vercel.headers.find((h: { source: string }) => h.source === '/schemas/ssot-report.schema.json');
    const kv = Object.fromEntries(latestEntry.headers.map((h: { key: string; value: string }) => [h.key, h.value]));
    expect(kv['Content-Type']).toMatch(/schema\+json/);
    expect(kv['Access-Control-Allow-Origin']).toBe('*');
  });

  it('--check falha e imprime instrução quando latest está stale', () => {
    // Baseline em dia.
    expect(run().status).toBe(0);
    // Corrompe o mirror para simular drift.
    const backup = readFileSync(LATEST, 'utf8');
    try {
      const drifted = backup.replace('"$id"', '"$id_drift"');
      require('fs').writeFileSync(LATEST, drifted);
      const chk = run(['--check']);
      expect(chk.status).toBe(1);
      expect(chk.stderr).toMatch(/stale|drift/i);
      expect(chk.stderr).toMatch(/publish-ssot-schema/);
    } finally {
      require('fs').writeFileSync(LATEST, backup);
    }
  });
});
