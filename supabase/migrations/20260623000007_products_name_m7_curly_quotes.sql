-- M7: Substituir curly quotes (U+2019/U+2018) por apostrofe ASCII em 4 produtos XBZ
-- Executado com app.write_source=pipeline para nao bloquear name em locked_fields
SELECT set_config('app.write_source','pipeline',true);
UPDATE public.products
SET name = REPLACE(REPLACE(name, U&'\2019', ''''), U&'\2018', '''')
WHERE name ~ U&'[\2018\2019]';
SELECT set_config('app.write_source','ui',true);
