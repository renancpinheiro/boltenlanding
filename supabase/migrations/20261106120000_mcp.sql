-- Servidor MCP (seção 8 do briefing): busca por similaridade (para não duplicar pedidos)
-- e mesclagem pela service role. Não altera nenhuma política de RLS.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Busca em itens por texto (sem acento, por similaridade de trigramas), categoria e status.
-- Devolve relevancia de 0 a 1; acima de 0,6 costuma ser o mesmo pedido, entre 0,4 e 0,6 é só assunto parecido.
create or replace function buscar_itens(p_texto text default null, p_categoria text default null, p_status text[] default null, p_limite integer default 10)
returns table (
  id uuid, titulo_pt text, titulo_es text, descricao_pt text, descricao_es text,
  categoria categoria_item, status status_item, votos integer, comentarios integer,
  criado_em timestamptz, lancado_em timestamptz, relevancia real
)
language sql stable security definer
set search_path = public, extensions
as $$
  with q as (select nullif(trim(unaccent(lower(coalesce(p_texto, '')))), '') as t)
  select i.id, i.titulo_pt, i.titulo_es, i.descricao_pt, i.descricao_es, i.categoria, i.status,
         (select count(*) from votos v where v.item_id = i.id)::integer as votos,
         (select count(*) from comentarios c where c.item_id = i.id and c.apagado_em is null)::integer as comentarios,
         i.criado_em, i.lancado_em,
         (case when q.t is null then 0 else greatest(
            word_similarity(q.t, unaccent(lower(i.titulo_pt))),
            word_similarity(q.t, unaccent(lower(coalesce(i.titulo_es, '')))),
            word_similarity(q.t, unaccent(lower(coalesce(i.descricao_pt, '')))) * 0.9,
            word_similarity(q.t, unaccent(lower(coalesce(i.texto_original, '')))) * 0.7) end)::real as relevancia
  from itens i, q
  where (p_categoria is null or i.categoria::text = p_categoria)
    and (p_status is null or i.status::text = any (p_status))
    and (q.t is null
         or word_similarity(q.t, unaccent(lower(i.titulo_pt))) > 0.3
         or word_similarity(q.t, unaccent(lower(coalesce(i.titulo_es, '')))) > 0.3
         or word_similarity(q.t, unaccent(lower(coalesce(i.descricao_pt, '')))) > 0.3
         or word_similarity(q.t, unaccent(lower(coalesce(i.texto_original, '')))) > 0.3)
  order by relevancia desc, votos desc, i.criado_em desc
  limit greatest(1, least(coalesce(p_limite, 10), 50))
$$;
revoke execute on function buscar_itens(text, text, text[], integer) from public, anon;
grant execute on function buscar_itens(text, text, text[], integer) to authenticated, service_role;

-- Mesclar sem exigir sessão de admin: só a service role (MCP) chama.
create or replace function mesclar_itens_servico(p_origem uuid, p_destino uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_origem = p_destino then raise exception 'Origem e destino iguais'; end if;
  insert into votos (item_id, origem, partner_ref, hash_navegador, hash_ip, criado_em)
    select p_destino, origem, partner_ref, hash_navegador, hash_ip, criado_em from votos where item_id = p_origem
    on conflict do nothing;
  delete from votos where item_id = p_origem;
  update comentarios set item_id = p_destino where item_id = p_origem;
  update itens set status = 'mesclado', mesclado_em = p_destino where id = p_origem;
end $$;
revoke execute on function mesclar_itens_servico(uuid, uuid) from public, anon, authenticated;
grant execute on function mesclar_itens_servico(uuid, uuid) to service_role;
