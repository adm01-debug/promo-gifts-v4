-- Normaliza eventuais nulos legados e fixa default + NOT NULL
UPDATE public.quotes SET synced_to_bitrix = false WHERE synced_to_bitrix IS NULL;
ALTER TABLE public.quotes ALTER COLUMN synced_to_bitrix SET DEFAULT false;
ALTER TABLE public.quotes ALTER COLUMN synced_to_bitrix SET NOT NULL;