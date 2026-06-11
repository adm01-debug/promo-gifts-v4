-- p2_acl_03: grant de leitura na view v_ai_function_routing_effective
--
-- Contexto: a UI admin de roteamento de IA lê v_ai_function_routing_effective
-- (config efetiva de ai_function_routing + defaults), mas a view foi criada sem
-- NENHUM grant para anon/authenticated — toda leitura do frontend falhava com
-- permission denied. A tabela-base ai_function_routing já é legível por
-- authenticated; a view não expõe nada além dela.
--
-- anon permanece sem acesso (configuração de roteamento é assunto interno).

GRANT SELECT ON public.v_ai_function_routing_effective TO authenticated;
GRANT SELECT ON public.v_ai_function_routing_effective TO service_role;
