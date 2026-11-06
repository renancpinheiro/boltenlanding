# Roadmap dos parceiros: Supabase

Projeto Supabase novo, só para o roadmap (`partners.bolten.io/pt/roadmap/`). Nada aqui é segredo:
as chaves secretas ficam só nos secrets das Edge Functions.

## 1. Criar o projeto

1. [supabase.com](https://supabase.com) > New project. Região: South America (São Paulo).
2. Guardar a **Project URL** e a **anon (publishable) key** (Settings > API). Elas vão para `assets/roadmap/config.js`.
3. Authentication > Providers > Email: deixar só **Magic link** ligado (sem senha). Em URL Configuration,
   colocar `https://partners.bolten.io` como Site URL e `https://partners.bolten.io/admin/roadmap/` em Redirect URLs.

## 2. Banco

Com a CLI (`npm i -g supabase`):

```bash
supabase link --project-ref <ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

Ou colar `migrations/20261105000000_roadmap.sql` e depois `seed.sql` no SQL Editor.

As migrações criam tabelas (`itens`, `votos`, `lancamentos`, `comentarios`, `admins`, `limites`), as views públicas
(`itens_com_votos`, `comentarios_publicos`), a view do time (`itens_admin`), o bucket `roadmap` no Storage,
as funções `is_admin()`, `incrementar_limite()` e `mesclar_itens()`, e a RLS:

- o público lê só as views e `lancamentos` com `publicado = true`; nunca escreve direto;
- o time (quem está em `admins`) lê e escreve tudo pelo painel, com a própria sessão;
- as Edge Functions escrevem com a service role.

## 3. Cadastrar o time

Cada pessoa entra uma vez pelo painel (`/admin/roadmap/`) com o link mágico, o que cria o usuário em `auth.users`.
Depois, no SQL Editor:

```sql
insert into admins (user_id, nome, email)
select id, 'Renan', email from auth.users where email = 'renan.pinheiro@bolten.io';
```

Repetir para Carlos e Enzo. Quem não está em `admins` consegue receber o link, mas o painel recusa a entrada.

## 4. Edge Functions

Secrets (Project > Edge Functions > Secrets, ou `supabase secrets set`):

| Secret | Uso |
|---|---|
| `HASH_SALT` | sal do SHA-256 do IP e do id do navegador (string longa e aleatória) |
| `ANTHROPIC_API_KEY` | `formatar_pedido` (IA que organiza o pedido) |
| `TURNSTILE_SECRET` | captcha invisível em `criar_pedido` e `comentar` (opcional; sem ele, não exige captcha) |
| `ORIGENS_PERMITIDAS` | CORS, separado por vírgula. Padrão: `https://partners.bolten.io` |
| `ROADMAP_MCP_KEY` | chave do servidor MCP (string longa e aleatória) |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente nas funções.

```bash
supabase functions deploy votar formatar_pedido criar_pedido comentar traduzir mcp --no-verify-jwt
```

Limites por IP (hash): 30 votos/hora, 20 formatações/hora, 5 pedidos/dia, 10 comentários/hora.

### Tradução automática (`traduzir`)

Só o time chama, com a própria sessão do painel (a function valida o token no Auth e confere `admins`).
Recebe `{ tipo: "item" | "lancamento", id, forcar? }` e preenche o idioma que falta com a API do Claude,
marcando `traducao_automatica_es` (ou `traducao_automatica_pt`, para pedidos escritos em espanhol) até alguém
editar aquele lado na mão. O painel chama sozinho ao aprovar um pedido e ao salvar item ou lançamento sem ES;
o botão "Traduzir de novo" nos formulários refaz com `forcar: true`.

`itens.idioma_origem` guarda em que idioma o parceiro escreveu. Pedido em ES entra com o ES copiado no PT
(o PT é obrigatório) e ganha o PT traduzido na aprovação.

## 5. Ligar a página

Em `assets/roadmap/config.js`:

```js
window.ROADMAP_CONFIG = {
  supabaseUrl: "https://<ref>.supabase.co",
  supabaseAnonKey: "<anon key>",
  turnstileSiteKey: "<site key do Turnstile, opcional>"
};
```

Sem `supabaseUrl`, a página mostra os dados de exemplo de `assets/roadmap/dados-exemplo.js` e não grava nada.

## Servidor MCP (`mcp`)

Edge Function que expõe o roadmap como servidor MCP (Streamable HTTP, sem sessão) para o Claude e para o n8n.
URL: `https://<ref>.supabase.co/functions/v1/mcp`. Autenticação por chave, no secret `ROADMAP_MCP_KEY`:

- **Claude Code**: `claude mcp add --transport http roadmap https://<ref>.supabase.co/functions/v1/mcp --header "Authorization: Bearer <chave>"`
- **claude.ai e Claude Desktop** (Configurações > Conectores > Adicionar conector personalizado): a tela só aceita URL,
  então a chave vai nela: `https://<ref>.supabase.co/functions/v1/mcp?chave=<chave>`. Sem OAuth.
- **n8n**: nó MCP Client com transporte HTTP e credencial Bearer com a chave.

Ferramentas: `buscar_itens`, `ver_item`, `criar_pedido` (formata pela IA, entra como `aberto` ou, com `status: em_analise`,
na fila do painel; devolve parecidos em vez de duplicar; `observacao` guarda uma nota junto do texto original), `votar`, `comentar` (como Time Bolten), `listar_pendentes`, `aprovar`, `mudar_status`, `mesclar`,
`criar_lancamento` e `listar_lancados_do_mes` (base do e-mail mensal). A busca usa `pg_trgm` + `unaccent`
pela função SQL `buscar_itens`; a mesclagem usa `mesclar_itens_servico` (só service role).
A rotina semanal do #client-feedbacks que alimenta o roadmap está em `docs/roadmap/ROTINA-CLIENT-FEEDBACKS.md`.

## Migração do Fider e do Notion (feita em 06/11/2026)

Os pedidos vieram da base "Feature Request - Bolten" do Notion, que já consolidava Fider e Slack sem duplicidade:
196 itens e 1.985 votos (origem `fider` ou `slack`, um registro por voto, para a contagem bater). Cada item guarda a
URL do Notion em `itens.ref_externa`, as "Variações conhecidas" em `texto_original` (visível só para o time) e o ES
marcado como tradução automática. Regra de status: Backlog com 3 votos ou mais virou `aberto`; o resto entrou como
`em_analise` para o time decidir no painel. Categorias novas criadas para a migração: `relatorios`, `pagamentos`
e `integracoes`. O SQL dos lotes não fica no repositório porque contém nomes de parceiros.

## Próximas rodadas (fora desta entrega)

- Comentários do Fider (não estavam no Notion) e desligamento do Fider após a divulgação.
