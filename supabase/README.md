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

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente nas funções.

```bash
supabase functions deploy votar formatar_pedido criar_pedido comentar traduzir --no-verify-jwt
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

## Próximas rodadas (fora desta entrega)

- Servidor MCP (seção 8) e migração do Fider/Notion (seção 9).
