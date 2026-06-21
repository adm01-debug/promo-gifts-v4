-- Restore 5 tables incorrectly archived that are referenced by active trigger functions.
-- Without these tables in public, INSERTs/UPDATEs on core tables fail.

ALTER TABLE archive.supplier_settings SET SCHEMA public;         -- fn_spr_before_write (hash_excluded_fields)
ALTER TABLE archive.markup_configurations SET SCHEMA public;     -- fn_trigger_calculate_sale_price
ALTER TABLE archive.favorite_items_trash SET SCHEMA public;      -- fn_favorite_items_soft_delete BEFORE DELETE trigger
ALTER TABLE archive.mockup_credits SET SCHEMA public;            -- charge_mockup_credits_for_job AFTER INSERT/UPDATE trigger
ALTER TABLE archive.mockup_credit_transactions SET SCHEMA public; -- charge_mockup_credits_for_job AFTER INSERT/UPDATE trigger
