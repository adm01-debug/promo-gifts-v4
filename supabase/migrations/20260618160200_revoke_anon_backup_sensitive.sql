-- REVOKE anon SELECT de tabelas backup com dados sensíveis
-- _backup_stock_daily_summary_20260618 contém cost_price_open, cost_price_close
REVOKE ALL ON public._backup_stock_daily_summary_20260618 FROM anon;
