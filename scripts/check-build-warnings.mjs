import { spawn } from 'child_process';

const stripAnsi = (value) => value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

async function runBuildAndCheckWarnings() {
  console.log('🚀 Iniciando build de produção com verificação rigorosa de warnings...');

  const buildEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('=')),
  );
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const buildProcess = spawn(npmCommand, ['run', 'build'], {
    shell: process.platform === 'win32',
    env: { ...buildEnv, FORCE_COLOR: '1' },
  });

  let stdout = '';
  let stderr = '';

  buildProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    process.stdout.write(chunk);
  });

  buildProcess.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderr += chunk;
    process.stderr.write(chunk);
  });

  buildProcess.on('close', (code) => {
    console.log('\n--- Resultado do Build ---');

    // Lista de padrões que indicam warnings que devem falhar o build
    // Focamos em códigos de erro específicos do Vite/Rollup/TS para evitar falsos positivos
    const warningPatterns = [
      /\[vite:.*\]/i, // Erros de plugins do Vite
      /\[rollup:.*\]/i, // Erros do Rollup
      /TS\d+: /i, // Erros do TypeScript (ex: TS2322)
      /error/i, // Padrão genérico de erro
      /warning/i, // Padrão genérico de warning
      /Unused/i, // Código não utilizado
      /Expected/i, // Erros de sintaxe/parsing
      /console\.(warn|error)/i, // Captura mensagens de console emitidas durante o build/SSR
    ];

    const combinedOutput = stdout + stderr;
    const lines = combinedOutput.split('\n');

    let foundWarnings = [];

    // Lista de exceções permitidas (infraestrutura ou legadas seguras)
    const allowedExceptions = [
      'npm warn',
      'PostCSS plugin did not pass the `from` option',
      'dynamic import will not move module into another chunk',
      'Entry module "src/main.tsx" is using named and default exports together', // Rollup warning comum
      'Circular dependency', // Muitas vezes presente em libs grandes, avaliar se bloqueia
    ];

    for (const line of lines) {
      const cleanLine = stripAnsi(line).trim();

      if (!cleanLine) continue;
      if (cleanLine.startsWith('dist/')) continue;
      if (allowedExceptions.some((exc) => cleanLine.includes(exc))) continue;

      if (warningPatterns.some((pattern) => pattern.test(cleanLine))) {
        foundWarnings.push(cleanLine);
      }
    }

    if (code !== 0) {
      console.error(`❌ O build falhou com código de saída ${code}.`);
      process.exit(1);
    }

    if (foundWarnings.length > 0) {
      console.error(
        `❌ Build concluído, mas foram encontrados ${foundWarnings.length} warnings/erros impeditivos:`,
      );
      foundWarnings.slice(0, 20).forEach((w) => console.error(`   - ${w}`));
      if (foundWarnings.length > 20)
        console.error(`   ... e mais ${foundWarnings.length - 20} warnings.`);
      process.exit(1);
    }

    console.log('✅ Build concluído com sucesso e SEM warnings detectados! 10/10.');
    process.exit(0);
  });
}

runBuildAndCheckWarnings().catch((err) => {
  console.error('💥 Erro fatal no script de CI:', err);
  process.exit(1);
});
