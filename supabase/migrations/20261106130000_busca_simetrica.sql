-- Busca por similaridade simétrica nos títulos: um pedido novo com título longo precisa achar
-- um pedido antigo com título curto (e vice-versa). Sem isso, criar_pedido não via duplicados.

create or replace function buscar_itens(p_texto text default null, p_categoria text default null, p_status text[] default null, p_limite integer default 10)
returns table (
  id uuid, titulo_pt text, titulo_es text, descricao_pt text, descricao_es text,
  categoria categoria_item, status status_item, votos integer, comentarios integer,
  criado_em timestamptz, lancado_em timestamptz, relevancia real
)
language sql stable security definer
set search_path = public, extensions
as $$
  with q as (select nullif(trim(unaccent(lower(coalesce(p_texto, '')))), '') as t),
  base as (
    select i.*,
           unaccent(lower(i.titulo_pt)) as tpt,
           unaccent(lower(coalesce(i.titulo_es, ''))) as tes,
           unaccent(lower(coalesce(i.descricao_pt, ''))) as dpt,
           unaccent(lower(coalesce(i.texto_original, ''))) as orig
    from itens i
    where (p_categoria is null or i.categoria::text = p_categoria)
      and (p_status is null or i.status::text = any (p_status))
  ),
  pontuada as (
    select b.*,
           (case when q.t is null then 0 else greatest(
              word_similarity(q.t, b.tpt), word_similarity(b.tpt, q.t),
              word_similarity(q.t, b.tes), word_similarity(b.tes, q.t),
              word_similarity(q.t, b.dpt) * 0.9,
              word_similarity(q.t, b.orig) * 0.7) end)::real as relevancia
    from base b, q
  )
  select p.id, p.titulo_pt, p.titulo_es, p.descricao_pt, p.descricao_es, p.categoria, p.status,
         (select count(*) from votos v where v.item_id = p.id)::integer as votos,
         (select count(*) from comentarios c where c.item_id = p.id and c.apagado_em is null)::integer as comentarios,
         p.criado_em, p.lancado_em, p.relevancia
  from pontuada p, q
  where q.t is null or p.relevancia > 0.3
  order by p.relevancia desc, votos desc, p.criado_em desc
  limit greatest(1, least(coalesce(p_limite, 10), 50))
$$;
