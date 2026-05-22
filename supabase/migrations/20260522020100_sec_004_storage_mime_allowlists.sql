-- ============================================================================
-- SEC-004 — Storage buckets: add MIME allowlists + size cap for scripts
-- ============================================================================
-- Source: auditoria back-end sênior 2026-05-22 (PR #55, mergeado).
--
-- Pré-fix: 7 de 8 buckets sem `allowed_mime_types` (aceitavam qualquer MIME).
-- `recibos-entrega` já tinha allowlist e fica intacto.
-- Bucket `scripts` sem `file_size_limit` definido (sem teto).
--
-- Mudanças (todos `public: false` permanecem privados; mantemos size caps):
--   - component-media (5MB):     imagens
--   - mockup-art-files (5MB):    imagens + PDF + SVG
--   - personalization-images (5MB): imagens
--   - product-videos (100MB):    MP4/WebM/QuickTime
--   - quarantine (5MB):          imagens (default — quarantine só usado para
--                                arquivos suspeitos do mesmo tipo das origens)
--   - scripts (1MB):             texto/shell/script (1MB cap NOVO)
--   - supplier-logos (2MB):      imagens
--
-- Backwards compat: storage.objects hoje só tem 1 row em `scripts` (.sh).
-- Todos os outros buckets estão vazios — sem risco de rejeitar uploads existentes.
-- ============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/svg+xml'
]
WHERE id = 'component-media';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/svg+xml','application/pdf',
  'application/postscript','image/vnd.adobe.photoshop','application/illustrator'
]
WHERE id = 'mockup-art-files';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/svg+xml'
]
WHERE id = 'personalization-images';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4','video/webm','video/quicktime','video/x-m4v'
]
WHERE id = 'product-videos';

-- Quarantine recebe arquivos rejeitados/suspeitos — em geral mesmo tipo
-- dos buckets de origem. Allowlist mínima para não atrapalhar fluxo de
-- segurança, mas evita upload de executáveis arbitrários por engano.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
  'application/pdf','text/plain','application/octet-stream'
]
WHERE id = 'quarantine';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/svg+xml'
]
WHERE id = 'supplier-logos';

-- Bucket `scripts` é mais peculiar — usado para hospedar scripts internos.
-- Limita tamanho a 1 MB (suficiente p/ qualquer script razoável) e MIMEs
-- a texto/shell/JSON. Hoje só há 1 arquivo .sh.
UPDATE storage.buckets
SET file_size_limit = 1048576,                          -- 1 MB
    allowed_mime_types = ARRAY[
      'text/plain',
      'text/x-shellscript',
      'application/x-sh',
      'application/x-shellscript',
      'application/json',
      'application/javascript',
      'application/octet-stream'                         -- legacy fallback
    ]
WHERE id = 'scripts';
