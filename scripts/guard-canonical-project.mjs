import fs from 'fs';
import { execSync } from 'child_process';

// fix_version: guard-scope-runtime-only-2026-07-03
// Scope: only src/ and supabase/functions/ (runtime code).
// Excludes: docs, migrations, scripts, tests, sql, md files.
// Filters: comment-only lines (// /* * -- # <!--) are never flagged.

const CANONICAL_ID = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN_ID = 'pqpdolkaeqlyzpdpbizo';

console.log('[CI Guard] Verificando ID proibido em codigo runtime: ' + FORBIDDEN_ID + '...');

function hasCommand(cmd) {
  try { execSync('command -v ' + cmd, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') ||
         t.startsWith('--') || t.startsWith('#') || t.startsWith('<!--');
}

function extractContent(matchLine) {
  const parts = matchLine.split(':');
  if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
    return parts.slice(2).join(':');
  }
  return parts.slice(1).join(':');
}

const SCAN_DIRS = ['src', 'supabase/functions'];

const EXCLUDE_GLOBS = [
  '**/__tests__/**', '**/tests/**',
  '**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.jsx',
  '**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js',
];

const EXCLUDE_DIRS_GREP  = ['__tests__', 'tests', 'node_modules', '.git', 'dist', '.agents', '.next'];
const EXCLUDE_EXTS_GREP  = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js', '.spec.js'];

try {
  let rawHits = [];
  const existingDirs = SCAN_DIRS.filter(function(d) { return fs.existsSync(d); });

  if (existingDirs.length === 0) {
    console.log('[CI Guard] Nenhum dir de scan existe — skip.');
  } else if (hasCommand('rg')) {
    var excludeArgs = EXCLUDE_GLOBS.map(function(g) { return '--glob "!' + g + '"'; }).join(' ');
    var targetArgs  = existingDirs.join(' ');
    var cmd = 'rg "' + FORBIDDEN_ID + '" --line-number ' + excludeArgs + ' ' + targetArgs;
    try {
      var out = execSync(cmd, { encoding: 'utf8' });
      rawHits = out.trim().split('\n').filter(Boolean);
    } catch (e) {
      rawHits = (e.stdout || '').trim().split('\n').filter(Boolean);
    }
  } else {
    for (var i = 0; i < existingDirs.length; i++) {
      var dir = existingDirs[i];
      var exDirs  = EXCLUDE_DIRS_GREP.map(function(d) { return '--exclude-dir=' + d; }).join(' ');
      var exFiles = EXCLUDE_EXTS_GREP.map(function(e) { return '--exclude="*' + e + '"'; }).join(' ');
      var gcmd = 'grep -rIn ' + exDirs + ' ' + exFiles + ' "' + FORBIDDEN_ID + '" "' + dir + '"';
      try {
        var gout = execSync(gcmd, { encoding: 'utf8' });
        rawHits = rawHits.concat(gout.trim().split('\n').filter(Boolean));
      } catch (ge) {
        rawHits = rawHits.concat(((ge.stdout || '').trim().split('\n').filter(Boolean)));
      }
    }
  }

  var hits = rawHits.filter(function(line) {
    return !isCommentLine(extractContent(line));
  });

  if (hits.length > 0) {
    console.error('\x1b[31m[CRITICAL ERROR]\x1b[0m ID proibido (' + FORBIDDEN_ID + ') em codigo runtime:');
    console.error(hits.join('\n'));
    console.error('\x1b[33mAponte configs runtime para o projeto canonico: ' + CANONICAL_ID + '\x1b[0m');
    process.exit(1);
  }

  console.log('\x1b[32m[OK]\x1b[0m Nenhuma referencia proibida no codigo runtime.');

  var criticalFiles = [
    'src/integrations/supabase/client.ts',
    'supabase/config.toml',
  ];

  for (var j = 0; j < criticalFiles.length; j++) {
    var file = criticalFiles[j];
    if (fs.existsSync(file)) {
      var content = fs.readFileSync(file, 'utf8');
      if (content.indexOf(CANONICAL_ID) === -1) {
        console.error('\x1b[31m[ERROR]\x1b[0m ID canonico (' + CANONICAL_ID + ') ausente em ' + file);
        process.exit(1);
      }
    }
  }

  console.log('\x1b[32m[OK]\x1b[0m ID canonico verificado nos arquivos criticos.');
  process.exit(0);

} catch (error) {
  console.error('[CI Guard] Erro inesperado:', error.message);
  process.exit(1);
}
