#!/bin/bash
set -e

echo "🚀 Iniciando pipeline de CI local..."

echo "1. Linting (strict)..."
npm run qa:lint

echo "2. Typechecking..."
npm run qa:typecheck

echo "3. Unit & Integration Tests..."
npm run test:run

echo "4. RLS Validation Tests..."
# Rodar os testes de RLS que acabamos de criar
npx vitest run tests/rls/live-rls.test.ts

echo "5. E2E Tests (Smoke)..."
# Requer servidor rodando ou configuração de E2E_BASE_URL
if [ -n "$E2E_BASE_URL" ]; then
  npm run test:e2e:smoke
else
  echo "⚠️ Pulando E2E (E2E_BASE_URL não definida). Use 'npm run test:e2e:smoke' com o servidor rodando."
fi

echo "✅ Pipeline concluída com sucesso!"
