#!/usr/bin/env node
/**
 * Testes do parser de `check-invoke-direct-calls.mjs` (Onda 18).
 * Roda com `node --test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../check-invoke-direct-calls.mjs', import.meta.url));

function runInSandbox(files) {
  const dir = mkdtempSync(join(tmpdir(), 'invoke-gate-'));
  const scripts = join(dir, 'scripts');
  const src = join(dir, 'src');
  const libEdge = join(src, 'lib', 'edge');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(libEdge, { recursive: true });
  // Copia o script para dentro do sandbox p/ que ROOT resolva certo.
  execFileSync('cp', [SCRIPT, join(scripts, 'check-invoke-direct-calls.mjs')]);
  // SSOT stub — deve ser ignorado.
  writeFileSync(
    join(libEdge, 'safeInvokeCall.ts'),
    'export const x = supabase.functions.invoke("ssot-ignored");\n',
  );
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  }
  const run = (env = {}) => {
    try {
      const out = execFileSync('node', ['scripts/check-invoke-direct-calls.mjs'], {
        cwd: dir,
        env: { ...process.env, ...env },
        encoding: 'utf8',
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
    }
  };
  return { dir, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('cria baseline no primeiro run', () => {
  const { run, cleanup } = runInSandbox({
    'src/a.ts': 'await supabase.functions.invoke("a");\n',
  });
  try {
    const r = run();
    assert.equal(r.code, 0);
    assert.match(r.out, /baseline criada/);
  } finally {
    cleanup();
  }
});

test('call site novo fora da baseline → falha', () => {
  const { dir, run, cleanup } = runInSandbox({
    'src/a.ts': 'await supabase.functions.invoke("a");\n',
  });
  try {
    assert.equal(run().code, 0); // cria baseline
    writeFileSync(join(dir, 'src', 'b.ts'), 'await supabase.functions.invoke("b");\n');
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.out, /NOVA\(S\) chamada/);
    assert.match(r.out, /src\/b\.ts/);
  } finally {
    cleanup();
  }
});

test('comentário e string literal são ignorados', () => {
  const { run, cleanup } = runInSandbox({
    'src/a.ts':
      '// supabase.functions.invoke("no")\n' +
      '/* supabase.functions.invoke("no") */\n' +
      'const s = "supabase.functions.invoke(\\"no\\")";\n',
  });
  try {
    const r = run();
    assert.equal(r.code, 0);
    // baseline vazia
    assert.match(r.out, /0 call sites/);
  } finally {
    cleanup();
  }
});

test('acesso dinâmico ["functions"].invoke é detectado', () => {
  const { dir, run, cleanup } = runInSandbox({
    'src/a.ts': '// vazio\n',
  });
  try {
    assert.equal(run().code, 0);
    writeFileSync(
      join(dir, 'src', 'dyn.ts'),
      'await supa["functions"].invoke("x");\n',
    );
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.out, /src\/dyn\.ts/);
  } finally {
    cleanup();
  }
});

test('arquivos de teste são ignorados', () => {
  const { run, cleanup } = runInSandbox({
    'src/__tests__/foo.ts': 'await supabase.functions.invoke("t");\n',
    'src/bar.test.ts': 'await supabase.functions.invoke("t");\n',
    'src/ok.ts': '// nada\n',
  });
  try {
    const r = run();
    assert.equal(r.code, 0);
    assert.match(r.out, /0 call sites/);
  } finally {
    cleanup();
  }
});

test('UPDATE_BASELINE=1 consolida remoções', () => {
  const { dir, run, cleanup } = runInSandbox({
    'src/a.ts': 'await supabase.functions.invoke("a");\n',
  });
  try {
    assert.equal(run().code, 0);
    // remove a chamada
    writeFileSync(join(dir, 'src', 'a.ts'), '// migrated\n');
    const warn = run();
    assert.equal(warn.code, 0); // não é strict
    assert.match(warn.out, /não foram encontradas/);
    const upd = run({ UPDATE_BASELINE: '1' });
    assert.equal(upd.code, 0);
    assert.match(upd.out, /atualizada|criada/);
    // agora baseline vazia; próximo run limpo
    const clean = run();
    assert.equal(clean.code, 0);
    assert.match(clean.out, /0 call sites/);
  } finally {
    cleanup();
  }
});
