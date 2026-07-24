REVOKE ALL ON TABLE public.product_popularity_30d FROM PUBLIC;
REVOKE ALL ON TABLE public.product_popularity_30d FROM anon;
REVOKE ALL ON TABLE public.product_popularity_30d FROM authenticated;
GRANT ALL ON TABLE public.product_popularity_30d TO service_role;