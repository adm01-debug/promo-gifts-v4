import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runBuildAndCheckWarnings() {
  console.log('🚀 Iniciando build de produção com verificação rigorosa de warnings...');

  const buildProcess = spawn('npm', ['run', 'build'], {
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
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
    const warningPatterns = [
      /warning/i,
      /✗/i,
      /failed/i,
      /error/i,
      /Expected/i,
      /PostCSS plugin did not pass the `from` option/i, // Exemplo de warning comum que o usuário pode querer barrar
    ];

    // Alguns warnings de dependências externas podem ser ignorados se necessário, 
    // mas a instrução é ser rigoroso ("falhar se houver warnings").
    const combinedOutput = stdout + stderr;
    const lines = combinedOutput.split('\n');
    
    let foundWarnings = [];

    for (const line of lines) {
      // Ignora warnings conhecidos que não são críticos para a lógica da app
      if (line.includes('npm warn')) continue; 
      if (line.includes('A PostCSS plugin did not pass the `from` option')) continue;
      if (line.includes('dynamic import will not move module into another chunk')) continue;
      
      if (warningPatterns.some(pattern => pattern.test(line))) {
        foundWarnings.push(line.trim());
      }
    }

    if (code !== 0) {
      console.error(`❌ O build falhou com código de saída ${code}.`);
      process.exit(1);
    }

    if (foundWarnings.length > 0) {
      console.error(`❌ Build concluído, mas foram encontrados ${foundWarnings.length} warnings/erros impeditivos:`);
      foundWarnings.slice(0, 10).forEach(w => console.error(`   - ${w}`));
      if (foundWarnings.length > 10) console.error(`   ... e mais ${foundWarnings.length - 10} warnings.`);
      process.exit(1);
    }

    console.log('✅ Build concluído com sucesso e SEM warnings! 10/10.');
    process.exit(0);
  });
}

runBuildAndCheckWarnings().catch(err => {
  console.error('💥 Erro fatal no script de CI:', err);
  process.exit(1);
});
