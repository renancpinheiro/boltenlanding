-- Roadmap público dos parceiros: banco, RLS, views e seed.
-- Aplicar com `supabase db push` ou colando no SQL Editor do projeto.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------
create type categoria_item as enum ('crm', 'atendimento', 'agente_ia', 'redes_sociais', 'conversoes', 'plataforma');
create type status_item as enum ('em_analise', 'aberto', 'planejado', 'em_construcao', 'lancado', 'recusado', 'mesclado');
create type origem_registro as enum ('pagina', 'call', 'whatsapp', 'slack', 'fider', 'notion', 'mcp');

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  criado_em timestamptz not null default now()
);

create table itens (
  id uuid primary key default gen_random_uuid(),
  titulo_pt text not null,
  titulo_es text,
  descricao_pt text not null,
  descricao_es text,
  categoria categoria_item not null,
  status status_item not null default 'em_analise',
  mesclado_em uuid references itens (id),
  criado_por_origem origem_registro not null default 'pagina',
  -- O que o partner escreveu antes da IA. Visível só para o time.
  texto_original text,
  autor_nome text,
  autor_email text,
  -- Tradução automática pendente de revisão (seção 7 do briefing).
  traducao_automatica_es boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  lancado_em timestamptz
);
create index itens_status_idx on itens (status);
create index itens_categoria_idx on itens (categoria);

create table votos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens (id) on delete cascade,
  origem origem_registro not null default 'pagina',
  partner_ref text,
  hash_navegador text,
  hash_ip text,
  criado_em timestamptz not null default now()
);
create index votos_item_idx on votos (item_id);
create unique index votos_unico_navegador on votos (item_id, hash_navegador) where origem = 'pagina';

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  titulo_pt text not null,
  titulo_es text,
  texto_pt text not null,
  texto_es text,
  categoria categoria_item not null,
  midia_url text,
  item_id uuid references itens (id) on delete set null,
  publicado boolean not null default false,
  traducao_automatica_es boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index lancamentos_data_idx on lancamentos (data desc) where publicado;

create table comentarios (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens (id) on delete cascade,
  nome text not null,
  email text,
  texto text not null,
  do_time boolean not null default false,
  user_id uuid references auth.users (id),
  hash_ip text,
  criado_em timestamptz not null default now(),
  apagado_em timestamptz
);
create index comentarios_item_idx on comentarios (item_id) where apagado_em is null;

-- Contadores por IP usados pelas Edge Functions (limites por hora ou dia).
create table limites (
  chave text primary key,            -- acao:hash_ip:janela
  contagem integer not null default 0,
  expira_em timestamptz not null
);
create index limites_expira_idx on limites (expira_em);

-- ---------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;
create trigger itens_atualizado before update on itens for each row execute function set_atualizado_em();
create trigger lancamentos_atualizado before update on lancamentos for each row execute function set_atualizado_em();

-- Incrementa um contador de limite e devolve o valor novo.
create or replace function incrementar_limite(p_chave text, p_segundos integer)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare v integer;
begin
  delete from limites where expira_em < now();
  insert into limites (chave, contagem, expira_em)
    values (p_chave, 1, now() + make_interval(secs => p_segundos))
    on conflict (chave) do update set contagem = limites.contagem + 1
    returning contagem into v;
  return v;
end $$;

-- ---------------------------------------------------------------
-- Views públicas (só colunas públicas, só linhas públicas)
-- ---------------------------------------------------------------
create view itens_com_votos
with (security_invoker = false) as
  select i.id, i.titulo_pt, i.titulo_es, i.descricao_pt, i.descricao_es,
         i.categoria, i.status, i.criado_em, i.lancado_em,
         (select count(*) from votos v where v.item_id = i.id)::integer as votos,
         (select count(*) from comentarios c where c.item_id = i.id and c.apagado_em is null)::integer as comentarios
  from itens i
  where i.status in ('aberto', 'planejado', 'em_construcao', 'lancado');

create view comentarios_publicos
with (security_invoker = false) as
  select c.id, c.item_id, c.nome, c.texto, c.do_time, c.criado_em
  from comentarios c
  join itens i on i.id = c.item_id
  where c.apagado_em is null
    and i.status in ('aberto', 'planejado', 'em_construcao', 'lancado');

-- Contagem de votos por item também para o time (todos os status).
create view itens_admin
with (security_invoker = true) as
  select i.*,
         (select count(*) from votos v where v.item_id = i.id)::integer as votos
  from itens i;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table admins enable row level security;
alter table itens enable row level security;
alter table votos enable row level security;
alter table lancamentos enable row level security;
alter table comentarios enable row level security;
alter table limites enable row level security;

-- O público nunca lê as tabelas diretamente (só as views e lancamentos).
revoke all on admins, itens, votos, comentarios, limites from anon;
grant select on itens_com_votos, comentarios_publicos, lancamentos to anon, authenticated;
grant select on itens_admin to authenticated;

-- Cada pessoa logada vê só a própria linha em admins (para o painel saber se é admin).
create policy admins_proprio on admins for select to authenticated using (user_id = auth.uid());

-- Time: acesso total via painel (escrita pública passa só pelas Edge Functions).
create policy itens_admin on itens for all to authenticated using (is_admin()) with check (is_admin());
create policy votos_admin on votos for all to authenticated using (is_admin()) with check (is_admin());
create policy comentarios_admin on comentarios for all to authenticated using (is_admin()) with check (is_admin());
create policy lancamentos_admin on lancamentos for all to authenticated using (is_admin()) with check (is_admin());

-- Público: lançamentos publicados.
create policy lancamentos_publicos on lancamentos for select to anon, authenticated using (publicado);

-- ---------------------------------------------------------------
-- Storage: mídia dos lançamentos (GIF ou MP4)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roadmap', 'roadmap', true, 26214400, array['image/gif', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do nothing;

create policy roadmap_midia_leitura on storage.objects for select to anon, authenticated using (bucket_id = 'roadmap');
create policy roadmap_midia_escrita on storage.objects for insert to authenticated with check (bucket_id = 'roadmap' and is_admin());
create policy roadmap_midia_edicao on storage.objects for update to authenticated using (bucket_id = 'roadmap' and is_admin());
create policy roadmap_midia_remocao on storage.objects for delete to authenticated using (bucket_id = 'roadmap' and is_admin());

-- ---------------------------------------------------------------
-- Mesclar: junta um pedido em outro item e soma os votos (só o time).
-- ---------------------------------------------------------------
create or replace function mesclar_itens(p_origem uuid, p_destino uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Sem permissão'; end if;
  if p_origem = p_destino then raise exception 'Origem e destino iguais'; end if;
  -- Votos do navegador que já votou no destino não se repetem.
  insert into votos (item_id, origem, partner_ref, hash_navegador, hash_ip, criado_em)
    select p_destino, origem, partner_ref, hash_navegador, hash_ip, criado_em from votos where item_id = p_origem
    on conflict do nothing;
  delete from votos where item_id = p_origem;
  update comentarios set item_id = p_destino where item_id = p_origem;
  update itens set status = 'mesclado', mesclado_em = p_destino where id = p_origem;
end $$;
grant execute on function mesclar_itens(uuid, uuid) to authenticated;
revoke execute on function incrementar_limite(text, integer) from anon, authenticated;
