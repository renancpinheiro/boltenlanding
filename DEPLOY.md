# Deploy — Vercel

Site estático (HTML + `assets/`), sem build. Servido por diretórios com barra final
(`/pt/`, `/pt/tour/`, `/pt/para/agencias/`). A raiz `/` faz detecção de idioma no cliente
e redireciona para `/pt/`, `/es/` ou `/en/`.

A configuração de runtime fica em [`vercel.json`](./vercel.json):

- `trailingSlash: true` — mantém as URLs idênticas às atuais (evita link quebrado e URL duplicada de SEO)
- cache longo para `assets/` (fontes com `immutable`)
- headers `X-Content-Type-Options` e `Referrer-Policy`

## 1. Importar o projeto na Vercel

1. Vercel → **Add New… → Project → Import** `renancpinheiro/boltenlanding`
2. **Framework Preset:** Other
3. **Build Command:** vazio · **Output Directory:** vazio (raiz do repo) · **Install Command:** vazio
4. **Deploy**

## 2. Branch de produção

Project → **Settings → Git → Production Branch = `main`**.

> Obs.: a *default branch* do repo no GitHub está apontada para `claude/mobile-marketing-lp-Jy1TZ`.
> Isso não afeta a Vercel depois que a Production Branch for fixada em `main`, mas o ideal é
> corrigir a default do repo para `main` (GitHub → Settings → General → Default branch).

## 3. Domínio

Project → **Settings → Domains → Add** o domínio (e o `www`, se for usar).
A Vercel mostra os registros exatos — **use os que ela exibir** (autoritativo). Valores padrão:

| Host | Tipo | Valor |
| --- | --- | --- |
| `@` (apex) | `A` | `76.76.21.21` |
| `www` | `CNAME` | `cname.vercel-dns.com` |

Aplicar no provedor de DNS. Propagação: minutos a algumas horas. TLS é emitido automático.

## 4. Desligar o GitHub Pages

Depois que a Vercel estiver servindo com o domínio:

GitHub → repo **Settings → Pages → Source = None** (despublica o Pages).

Se algum registro DNS antigo apontava para o GitHub Pages
(`185.199.108–111.153` / `renancpinheiro.github.io`), removê-lo após o corte.
