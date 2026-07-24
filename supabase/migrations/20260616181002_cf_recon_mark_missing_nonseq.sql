-- ============================================================================
-- CF-RECON 1+2 — Marcar 'missing' as referencias nao-seq confirmadas ausentes no CF
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- Evidencia: cf_images_batch_check (185/185 IDs ausentes no Cloudflare).
-- Idempotente (WHERE cf_sync_status <> 'missing'). Reversivel via cf_recon.action_log.
-- Atualiza apenas colunas cf_* + last_modified_source -> NAO dispara triggers de cascata
-- (verificado: nenhum trigger tem cf_sync_status no WHEN).
-- https://claude.ai/code/session_01MAV1SvJ69G694NWUzo2XeG
-- ============================================================================
with targets(cfid) as (
  values
   ('xbz-08275-d1'),('xbz-09070-d2'),('xbz-09080-d1'),('xbz-09080-d2'),('xbz-09148-d6'),
   ('xbz-09163-d1'),('xbz-09165-d5'),('xbz-09169-d4'),('xbz-10038-d1'),('xbz-10081-d2'),
   ('xbz-10081-d3'),('xbz-11329-d7'),('xbz-12514N-d1'),('xbz-12599-d1'),('xbz-12666-d1'),
   ('xbz-12727-d1'),('xbz-12727-d2'),('xbz-13203-d1'),
   ('xbz-bolsa-termica-7-litros-21408-1732277304'),('xbz-bone-poliester-aba-curva-23571d2-1750970418'),
   ('xbz-caderno-ecologico-com-caneta-laranja-23189-1747066779'),('xbz-caneca-termica-390ml-18550d2-1712002785'),
   ('xbz-caneta-metal-touch-26061d1-1761926696'),('xbz-caneta-metal-touch-antiestresse-verde-21387-1731610375'),
   ('xbz-copo-termico-500ml-com-abridor-inox-22391-1740582310'),('xbz-espelho-plastico-sem-aumento-17159d1-1694444309'),
   ('xbz-estojo-escolar-de-feltro-18071-1705956145'),('xbz-garrafa-aluminio-750ml-preto-27767-1777553352'),
   ('xbz-garrafa-verde-11103-1573143317'),('xbz-guindaste-miniatura-26242d2-1763487220'),
   ('xbz-kit-saquinho-coletor-dourado-16828-1690470545'),('xbz-microfone-dinamico-23764d3-1752667573'),
   ('xbz-power-bank-10-000mah-com-indicador-led-22932d3-1744809736'),('xbz-sacola-em-tnt-dourado-11265d1-1574180647'),
   ('xbz-squeeze-plastico-700ml-com-infusor-verde-escuro-8664-1541431698'),('xbz-umidificador-de-ar-com-led-24074d2-1753805714'),
   ('asia-bt305p-01-leg-c835f0'),('asia-ca8200-01-leg-e0e70b'),('asia-ca8500-01-leg-8ddc64'),('asia-ca9200-01-leg-365206'),
   ('asia-ca9510-01-leg-2c2ee3'),('asia-cad003-01-leg-38ac8a'),('asia-cad004-01-leg-d0c47b'),('asia-cad004c-01-leg-18106a'),
   ('asia-cad008-01-leg-bc6be4'),('asia-cad165-01-leg-fc8c67'),('asia-cad380p-01-leg-a2ec9c'),('asia-cm1027s-01-leg-08bbd3'),
   ('asia-cp0107d-01-leg-ac3ee2'),('asia-cv200p-01-leg-e6cb24'),('asia-cv250-01-leg-ab2fe9'),
   ('spot-92366_92367_amb--ref92367'),('spot-93582_93583_amb--ref93583'),('spot-93587_93622_93623_amb--ref93622'),
   ('spot-93587_93622_93623_amb--ref93623'),('spot-94333_94334_amb--ref94334'),('spot-97166_97167_amb--ref97167'),
   ('spot-97941_97944_97162_103--ref97941'),('spot-97941_97944_97162_105--ref97941'),('spot-97941_97944_97162_106--ref97941'),
   ('spot-97941_97944_97162_114--ref97941'),('spot-97941_97944_97162_c--ref97941'),
   ('xbz-0194gb-leg-c1c8e8'),('xbz-062-4gb-3-9938-1561556435-leg-adb666'),
   ('xbz-bloco-de-anotacoes-com-porta-caneta-marrom-16848-1690480722-leg-2c3b34'),
   ('xbz-bolsa-termica-5-litros-6709-1506947615-leg-4b8ffd'),('xbz-caderneta-couro-sintetico-20913-1727709690-leg-14d14c'),
   ('xbz-caderneta-em-couro-sintetico-marrom-16408-1684506983-leg-805396'),
   ('xbz-caderneta-em-couro-sintetico-marrom-18719-1710779963-leg-706c76'),
   ('xbz-caixa-de-som-com-carregador-por-inducao-13835-1640021344-leg-10ca99'),
   ('xbz-caixa-de-som-com-carregador-por-inducao-branco-13668-1639664292-leg-7130d0'),
   ('xbz-caixa-de-som-multimidia-branco-11019-1572454149-leg-161b64'),('xbz-calendario-permanente-mdf-26278-1763565464-leg-0b3503'),
   ('xbz-caneta-metal-touch-verde-9903-1561639996-leg-10dbc6'),('xbz-caneta-plastica-azul-claro-13394-1630932583-leg-e7b8c8'),
   ('xbz-chaveiro-metal-amarelo-15381-1668082002-leg-e02d01'),('xbz-chaveiro-plastico-amarelo-15045-1663593052-leg-bd470e'),
   ('xbz-churrasqueira-portatil-27356-1772476080-leg-c31d0f'),('xbz-er189b-ver-caneta-metal-2107-leg-e0dbc7'),
   ('xbz-estojo-para-kit-tecnologico-azul-escuro-24248-1755712933-leg-5dc680'),('xbz-garrafa-inox-650ml-17263-1695845091-leg-8bcd54'),
   ('xbz-garrafa-plastica-800ml-rosa-escuro-22989-1746473599-leg-7ea0a8'),('xbz-garrafa-termica-1-4-litros-vermelho-18048-1706816008-leg-ed9228'),
   ('xbz-kit-para-anotacoes-com-caneta-vermelho-20014-1723552939-leg-98b1f2'),('xbz-kit-porta-temperos-preto-16903-1691418216-leg-8a45b7'),
   ('xbz-memorias-leg-acb5d7'),('xbz-mini-climatizador-de-ar-portatil-branco-16642-1689017745-leg-0c80ae'),
   ('xbz-pacote-com-canetas-plasticas-23051-1778866540-leg-800eb6'),('xbz-pen-drive-sm-giratorio-metal-4gb-preto-4161-1480679895-leg-5b5fc9'),
   ('xbz-petisqueira-de-bambu-26-x-10-13536-1638188076-leg-bfec70'),('xbz-petisqueira-de-bambu-28-5-x-20-5-13549-1638187755-leg-a4ce26'),
   ('xbz-petisqueira-de-bambu-36-x-15-13533-1638188557-leg-427818'),('xbz-pratinha-8-gb-prata-4568-1484660725-leg-d67787'),
   ('xbz-squeeze-plastica-1-litro-laranja-21404-1731333238-leg-a71a9b'),('xbz-squeeze-plastico-800ml-branco-18183-1706880196-leg-0962d4'),
   ('xbz-squeeze-plastico-850ml-branco-22373-1741205761-leg-a0f37c'),('xbz-squeeze-plastico-900ml-transparente-20214-1725993799-leg-7107de'),
   ('xbz-squeeze-plastico-900ml-vermelho-20226-1726087839-leg-46bc9c'),
   ('spot-11117_119'),('spot-11117_119-c'),('spot-11125_105'),('spot-11125_105-a'),('spot-11132_103'),('spot-11132_103-c'),
   ('spot-11138_103'),('spot-11138_103-c'),('spot-28040_119'),('spot-28040_119_logo'),('spot-30512_108'),('spot-30512_112'),
   ('spot-30512_112-c'),('spot-30512_114-a'),('spot-30512_114-b'),('spot-30512_114-c'),('spot-30512_115-a'),('spot-30512_115-b'),
   ('spot-30512_183-b'),('spot-30512_196'),('spot-30513_106-c'),('spot-30513_106-d'),('spot-30514_109-b'),('spot-30514_114'),
   ('spot-30514_114-c'),('spot-30514_115-b'),('spot-30514_149-c'),('spot-30514_183-a'),('spot-30515_106-g'),('spot-38250_105'),
   ('spot-38250_106'),('spot-38250_108'),('spot-51102_124'),('spot-51162_160-a'),('spot-51256_128'),('spot-81110_102-a'),
   ('spot-81110_103-a'),('spot-81117_103-c'),('spot-81118_101-a'),('spot-81153_106'),('spot-92269_103'),('spot-92269_104'),
   ('spot-92523_114'),('spot-92523_114-a'),('spot-92523_114-b'),('spot-92523_114-c'),('spot-92523_114-d'),('spot-92523_123'),
   ('spot-92523_123-a'),('spot-92523_123-b'),('spot-92523_123-c'),('spot-92667_131'),('spot-92681_104_113'),('spot-92681_104_113-a'),
   ('spot-92914_103-a'),('spot-92925_103-a'),('spot-92925_103-c'),('spot-92925_104-a'),('spot-92925_104-c'),('spot-92928_103'),
   ('spot-92928_104'),('spot-92928_104-c'),('spot-92928_105'),('spot-92928_105-c'),('spot-93491_109'),('spot-93591_105'),
   ('spot-93591_105-a'),('spot-93795_103_set'),('spot-93885_100-set'),('spot-93892_128'),('spot-94059_103_127'),('spot-94060_103'),
   ('spot-94060_103-c'),('spot-94061_103'),('spot-94061_103-a'),('spot-94192_103'),('spot-94192_104'),('spot-94192_106'),
   ('spot-94192_109'),('spot-94615_103'),('spot-94615_103-c'),('spot-94615_104'),('spot-94970_103-a'),('spot-94970_105'),
   ('spot-94970_105-a'),('spot-94970_106'),('spot-94970_106-a')
),
pre as (
  select pi.id, pi.cloudflare_image_id, pi.cf_sync_status
  from public.product_images pi
  join targets t on t.cfid = pi.cloudflare_image_id
  where pi.cf_sync_status <> 'missing'
),
logged as (
  insert into cf_recon.action_log(actor,action,image_db_id,cf_image_id,old_status,new_status,evidence,reversible)
  select 'claude','mark_missing_confirmed_absent', pre.id, pre.cloudflare_image_id, pre.cf_sync_status, 'missing',
         jsonb_build_object('method','cf_images_batch_check','batch','non_seq_queue_185','result','absent'), true
  from pre
  returning 1
)
update public.product_images pi
set cf_sync_status      = 'missing',
    cf_last_error       = 'recon 2026-06-16: confirmado ausente no Cloudflare (varredura fila nao-seq)',
    cf_verified_at      = now(),
    cf_check_attempts   = pi.cf_check_attempts + 1,
    last_modified_source= 'claude'
from targets t
where pi.cloudflare_image_id = t.cfid
  and pi.cf_sync_status <> 'missing';
