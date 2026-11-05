-- Correções apontadas pelo Security Advisor da Supabase depois da primeira migração.
-- Nada aqui muda a RLS: só quem pode chamar as funções e o search_path do trigger.

-- 1. O Postgres dá EXECUTE a PUBLIC em toda função nova, e o revoke só de anon/authenticated
--    não cobre isso. Tiramos de PUBLIC e damos de volta só a quem precisa.

-- incrementar_limite: só as Edge Functions (service role) contam limites por IP.
revoke execute on function incrementar_limite(text, integer) from public, anon, authenticated;
grant execute on function incrementar_limite(text, integer) to service_role;

-- is_admin: usada dentro das políticas de RLS e do Storage, avaliadas como o usuário logado.
-- anon nunca passa por uma política que a chame, então não precisa executar.
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated, service_role;

-- mesclar_itens: chamada pelo painel (RPC) com a sessão do admin; já checa is_admin() por dentro.
revoke execute on function mesclar_itens(uuid, uuid) from public, anon;
grant execute on function mesclar_itens(uuid, uuid) to authenticated, service_role;

-- 2. Trigger de atualizado_em com search_path fixo.
alter function set_atualizado_em() set search_path = public;
