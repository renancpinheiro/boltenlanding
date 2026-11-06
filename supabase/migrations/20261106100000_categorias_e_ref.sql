-- Três categorias novas (vindas da base de feature requests do Notion) e referência externa dos itens.
-- Não altera nenhuma política de RLS.

alter type categoria_item add value if not exists 'relatorios';
alter type categoria_item add value if not exists 'pagamentos';
alter type categoria_item add value if not exists 'integracoes';

-- De onde o item veio (URL do Notion, número do Fider). Usada pela rotina de dedup e pelo MCP.
alter table itens add column ref_externa text;
create index itens_ref_externa_idx on itens (ref_externa) where ref_externa is not null;

-- A view do time usa select i.*, que o Postgres expande na criação: recriar para enxergar a coluna nova.
drop view if exists itens_admin;
create view itens_admin
with (security_invoker = true) as
  select i.*,
         (select count(*) from votos v where v.item_id = i.id)::integer as votos
  from itens i;
grant select on itens_admin to authenticated;
