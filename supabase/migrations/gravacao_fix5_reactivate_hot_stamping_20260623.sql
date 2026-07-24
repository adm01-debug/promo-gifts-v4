-- FIX #5: Reativa tabelas HOT_STAMPING com 7 tiers completos (R$2.00→R$0.32)
-- HS-COMFITA-01 e HS-SEMFITA-01 estavam inativas sem motivo documentado.
UPDATE tabela_preco_gravacao_oficial
SET ativo = true, updated_at = NOW()
WHERE id IN (
  '3f30e382-0279-44f6-9e5d-e1e2ee7b2682',  -- HS-COMFITA-01
  '7229e28f-8f1b-467c-ae78-25ad03aaa316'   -- HS-SEMFITA-01
);
