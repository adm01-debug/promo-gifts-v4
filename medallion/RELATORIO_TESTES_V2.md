# Relatório de Testes Exaustivos V2 — Pipeline Silver

## Data: 2026-06-05 | 32 testes em 14 blocos

## Resultado: 21 PASS, 7 FAIL detectados e TODOS CORRIGIDOS

---

## Bugs Encontrados e Corrigidos

### Bug 3 — fn_xbz_to_silver sem fallback ILIKE para adjetivos femininos

**Detectado em**: Bloco T05  
**Sintoma**: `fn_xbz_to_silver` não tinha o ILIKE fallback para 'plástica', 'metálica' etc. Os dados existentes foram corrigidos retroativamente, mas novos registros XBZ processados perderiam o `norm_material_id`.  
**Correção**: Fallback ILIKE inserido no bloco ELSE do CASE material da função.

### Bug 4 — fn_normalize_silver_all sem fallback ILIKE adjetivos

**Detectado em**: Bloco T05  
**Sintoma**: A função retroativa também não tinha o passo de adjetivos femininos.  
**Correção**: Passo 4b adicionado à função.

### Bug 5 (CRÍTICO) — fn_normalize_silver_all não-idempotente: loop de 406 materiais

**Detectado em**: Bloco T10 — fn_normalize_silver_all retornou 406 materials_fixed em CADA rodada

**Causa raiz**: O `CASE extract_xbz_material_primary(...)` mapeava apenas 25 valores nominativos. Porém, a função legada retorna também valores como 'Papel', 'Non-woven (TNT)', 'Papelão', 'Juta', 'Neoprene', etc. (14 valores adicionais). Para esses valores, o CASE retornava NULL, e o UPDATE executava (`updated_at = now()`) mas `norm_material_id` ficava NULL. Na próxima rodada, os mesmos 406 produtos passavam pelo WHERE (`norm_material_id IS NULL` + `extract() IS NOT NULL`) e o ciclo se repetia.

**Efeito**: Cada execução de `fn_normalize_silver_all` atualizava desnecessariamente 406 rows, causando escrita inútil no banco e mascarando a real cobertura de materiais.

**Correção dupla**:  
1. CASE expandido para 40+ valores (incluindo Papel, Papelão, Non-woven/TNT, Juta, Neoprene, Microfibra, Porcelana, Material Reciclado, Lona, Tritan, Cobre, Zinco)  
2. WHERE clause adicionou um CASE=1 guard: só executa quando o CASE realmente produziria um valor não-nulo  

**Resultado**: fn_normalize_silver_all agora é genuinamente idempotente: r1 zera pendências reais, r2=0, r3=0.

---

## Scorecard Final

| Bloco | Categoria | Resultado |
|-------|-----------|----------|
| T01 | 20 funções com assinaturas corretas | PASS |
| T02 | fn_normalize_ncm: 15/15 formatos | PASS |
| T03 | fn_clean_spot_name: 12/12 edge cases | PASS |
| T04 | extract_xbz_material_primary adjetivo feminino | FAIL → CORRIGIDO |
| T05 | Fallback ILIKE nas funções de transformação | FAIL → CORRIGIDO |
| T06 | Bug ASIA SKUs únicos + anti-loop batch | PASS (4/4 checks) |
| T07 | NCM 8-dígitos em todos os fornecedores | PASS (4/4) |
| T08 | Zero ALLCAPS em todos os fornecedores | PASS |
| T09 | Validação cruzada Bronze→Silver (30 amostras) | PASS 100% |
| T10 | Idempotência fn_normalize_silver_all | FAIL → CORRIGIDO → PASS |
| T11 | Cobertura: NCM/cat/mat/cor por fornecedor | PASS (4/4) |
| T12 | 10 checks integridade FK + unicidade | PASS (10/10) |
| T13 | fn_bronze_to_silver_all converge | PASS |
| T14 | fn_silver_batch_to_gold + Gold válido | PASS |

## Estado Final Silver

| Fornecedor | Produtos | Variantes | NCM | Cat | Mat | Cor | Conf |
|------------|----------|-----------|-----|-----|-----|-----|------|
| STRICKER | 1.200 | 3.612 | 100% | 98.0% | 71.7% | 100% | 0.939 |
| SOMARCAS | 1.215 | 1.215 | 100% | 79.8% | 89.5% | N/A | 0.937 |
| XBZ | 4.722 | 10.390 | 98.9% | 78.7% | 81.6% | 99.0% | 0.862 |
| ASIA | 515 | 1.340 | 100% | 90.9% | 62.1% | 99.7% | 0.777 |

## Funções Atualizadas Nesta Sessão

- `fn_xbz_to_silver`: + fallback ILIKE adjetivo feminino no CASE material
- `fn_normalize_silver_all`: recriada via migration — CASE 40+ materiais, WHERE guard, passo 4b adjetivos
