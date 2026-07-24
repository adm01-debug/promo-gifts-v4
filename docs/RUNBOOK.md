# 📘 Runbook Operacional — Promo Brindes

> Guia de procedimentos para incidentes e operações de rotina  
> **Última atualização:** 25/05/2026

---

## 🚨 Resposta a Incidentes

### Classificação de Severidade

| Nível | Descrição | SLA Resposta | SLA Resolução |
|-------|-----------|-------------|---------------|
| **P0** | Sistema fora do ar / dados corrompidos | 15 min | 1 hora |
| **P1** | Funcionalidade crítica indisponível | 30 min | 4 horas |
| **P2** | Bug impactando fluxo de vendas | 2 horas | 24 horas |
| **P3** | Bug cosmético / melhoria | 24 horas | Sprint seguinte |

### Fluxo de Resposta

```
1. DETECTAR → Alerta automático (error-reporter) ou relato manual
2. CLASSIFICAR → Determinar severidade (P0-P3)
3. COMUNICAR → Se P0/P1, acionar imediatamente o canal #engenharia-alertas; se P2/P3, registrar no canal de incidentes
4. INVESTIGAR → Checar logs, métricas e banco de dados
5. MITIGAR → Aplicar fix temporário se possível
6. RESOLVER → Implementar correção definitiva dentro do SLA da severidade
7. POSTMORTEM → Documentar usando [`docs/POSTMORTEM_TEMPLATE.md`](./POSTMORTEM_TEMPLATE.md)
```

> **Pós-incidente obrigatório:** todo P0/P1 gera post-mortem em até 48h usando o template padrão. Arquivar em `docs/postmortems/YYYY-MM-DD-slug.md`.

### Alertas para Canal de Engenharia

- **Falha crítica (P0/P1):** abrir thread no `#engenharia-alertas` em até **5 minutos** após classificação.
- **Mensagem inicial mínima:** severidade, impacto de negócio, escopo afetado, horário de início (UTC), owner atual e próximo checkpoint.
- **Cadência de atualização:**
  - **P0:** a cada 15 minutos até mitigação.
  - **P1:** a cada 30 minutos até mitigação.
- **Encerramento:** publicar causa raiz resumida + link para ticket/PR de correção e prazo do post-mortem.

### SLA de Correção por Severidade

| Severidade | Exemplo | SLA de correção | Owner primário | Escalonamento automático |
|------------|---------|------------------|----------------|---------------------------|
| **P0** | Sistema indisponível / corrupção de dados | **1 hora** | On-call de Engenharia | Tech Lead imediato + CTO em até 15 min |
| **P1** | Funcionalidade crítica indisponível | **4 horas** | Squad owner da área afetada | Tech Lead em até 30 min |
| **P2** | Fluxo principal degradado sem parada total | **24 horas** | Squad owner da feature | Engineering Manager se estourar SLA |
| **P3** | Impacto baixo / cosmético | **Próxima sprint** | Time responsável pelo domínio | Revisão em planning semanal |

> **Regra operacional:** SLA de resposta mede tempo até primeiro atendimento; SLA de correção mede tempo até restaurar operação (mitigação ou fix definitivo com risco controlado).

### Ownership e Escalonamento

1. **Atribuir owner único (DRI)** no momento da classificação do incidente.
2. **Definir owner de apoio** (backup) para cobrir investigação paralela (logs/DB/integrações).
3. **Registrar handoff explícito** quando ownership mudar (quem assume, horário UTC e motivo).
4. **Escalonar automaticamente** quando:
   - restarem **25% do SLA** sem mitigação;
   - houver risco de segurança/compliance;
   - houver dependência externa sem ETA confiável.
5. **Encerrar incidente** somente após validar serviço, comunicar no canal e criar ação corretiva rastreável (issue/PR).


---

## 🔄 Procedimentos de Rotina

### Deploy de Edge Functions

```bash
# Deploys são automáticos via Lovable Cloud.
# Para deploy manual (emergência):
npx supabase functions deploy <nome-da-funcao>
```

### Verificação de Saúde

1. **Frontend:** Acessar a URL publicada e verificar carregamento
2. **Backend:** Verificar status das Edge Functions no painel Lovable Cloud
3. **Banco:** Executar query de healthcheck:
   ```sql
   SELECT count(*) FROM profiles WHERE is_active = true;
   ```
4. **Integrações:** Testar endpoint Bitrix24 via Edge Function `quote-sync`

### Rotação de Secrets

1. Gerar nova chave no provedor (Bitrix24, Dropbox, etc.)
2. Atualizar via `secrets--update_secret` no Lovable
3. Verificar Edge Functions afetadas
4. Testar endpoints críticos

---

## 🗄️ Banco de Dados

### Backup e Restauração

- **Backups automáticos:** Lovable Cloud mantém backups diários
- **Point-in-Time Recovery:** Disponível via painel de administração
- **Exportação manual:**
  ```sql
  -- Exportar orçamentos dos últimos 30 dias
  SELECT * FROM quotes 
  WHERE created_at >= now() - interval '30 days'
  ORDER BY created_at DESC;
  ```

### Queries de Diagnóstico

```sql
-- Orçamentos travados (sem atualização > 7 dias)
SELECT id, quote_number, status, updated_at 
FROM quotes 
WHERE status NOT IN ('approved', 'rejected', 'cancelled')
AND updated_at < now() - interval '7 days';

-- Usuários inativos (sem login > 30 dias)
SELECT id, full_name, email, last_login_at 
FROM profiles 
WHERE last_login_at < now() - interval '30 days'
AND is_active = true;

-- Erros recentes (últimas 24h)
SELECT action, details->>'message' as error_msg, created_at
FROM admin_audit_log 
WHERE action = 'client_error'
AND created_at >= now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Manutenção

```sql
-- Limpar logs antigos (> 90 dias)
DELETE FROM admin_audit_log 
WHERE created_at < now() - interval '90 days';

-- Limpar telemetria antiga (> 60 dias)
DELETE FROM query_telemetry 
WHERE created_at < now() - interval '60 days';

-- (Web Vitals removidos: rastreamento agora é feito por sistema externo.)
```

---

## 🔐 Segurança

### Resposta a Vazamento de Credenciais

1. **Revogar imediatamente** a credencial comprometida
2. Rotacionar todas as chaves do mesmo provedor
3. Auditar `admin_audit_log` para acessos suspeitos
4. Verificar `login_attempts` para tentativas anômalas
5. Notificar equipe e documentar no postmortem

### Bloqueio de Usuário

```sql
-- Desativar usuário comprometido
UPDATE profiles SET is_active = false WHERE user_id = '<UUID>';

-- Verificar últimas ações do usuário
SELECT * FROM admin_audit_log 
WHERE user_id = '<UUID>' 
ORDER BY created_at DESC LIMIT 50;
```

### Auditoria de RLS

```sql
-- Verificar tabelas sem RLS
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT IN (
  SELECT tablename FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE c.relrowsecurity = true
);
```

---

## 🔥 Disaster Recovery

### Cenários e Procedimentos

#### Cenário 1: Frontend Inacessível
1. Verificar status do Lovable Cloud
2. Checar DNS e certificado SSL
3. Verificar se o build está válido (último deploy)
4. Restaurar versão anterior se necessário

#### Cenário 2: Edge Functions Falhando
1. Verificar logs da função específica
2. Checar se secrets estão configurados
3. Verificar limites de memória/CPU
4. Re-deploy da função

#### Cenário 3: Banco de Dados Corrompido
1. **NÃO tente corrigir manualmente**
2. Contactar suporte Lovable Cloud
3. Solicitar restauração de backup
4. Validar integridade após restauração

#### Cenário 4: Integração Bitrix24 Offline
1. Orçamentos continuam funcionando localmente
2. Sincronizações pendentes ficam na fila
3. Quando Bitrix voltar, executar sync manual
4. Verificar dados duplicados

---

## 📊 Métricas de Monitoramento

| Métrica | Threshold Alerta | Threshold Crítico |
|---------|------------------|--------------------|
| Tempo de resposta API | > 2s | > 5s |
| Taxa de erro (5xx) | > 1% | > 5% |
| Erros JS no cliente | > 10/hora | > 50/hora |
| Login failures | > 5/min | > 20/min |
| Queries lentas (>1s) | > 5/hora | > 20/hora |

---

## 📞 Contatos de Escalação

| Nível | Quem | Quando |
|-------|------|--------|
| L1 | Desenvolvedor de plantão | P2-P3 |
| L2 | Tech Lead | P1 |
| L3 | CTO + Suporte Lovable | P0 |

---

**Mantido por:** Equipe de Desenvolvimento  
**Revisão:** Trimestral  
**Próxima revisão:** Julho 2026
