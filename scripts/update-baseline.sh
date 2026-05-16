#!/bin/bash

# Script para atualizar os baselines visuais após aprovação manual
echo "🚀 Iniciando atualização dos baselines visuais para a UI de Login..."

# Executa o Playwright com a flag --update-snapshots
bunx playwright test e2e/flows/99-auth-ui-baseline.spec.ts --update-snapshots

echo "✅ Baselines atualizados com sucesso!"
echo "💡 Revise as mudanças no diretório e2e/flows/__snapshots__ antes de dar commit."
