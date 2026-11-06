-- Tradução automática (seção 7 do briefing): de onde o pedido veio e qual lado foi traduzido pela IA.
-- Não altera nenhuma política de RLS.

alter table itens
  add column idioma_origem text not null default 'pt' check (idioma_origem in ('pt', 'es')),
  add column traducao_automatica_pt boolean not null default false;

comment on column itens.idioma_origem is 'Idioma em que o parceiro escreveu. A IA traduz para o outro.';
comment on column itens.traducao_automatica_pt is 'PT preenchido pela IA e ainda não revisado (pedidos escritos em ES).';

-- A view do time foi criada com select i.*, que o Postgres expande na criação,
-- então precisa ser recriada para enxergar as colunas novas.
drop view if exists itens_admin;
create view itens_admin
with (security_invoker = true) as
  select i.*,
         (select count(*) from votos v where v.item_id = i.id)::integer as votos
  from itens i;
grant select on itens_admin to authenticated;
