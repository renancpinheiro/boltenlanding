# Bolten — Landing Page (réplica estática)

Réplica **estática e fiel** da landing page oficial da Bolten (versão pt), extraída do
app oficial (`bolten`, em `app/views/guests/home/bolten/pt`). Serve como **sandbox de
marketing/conteúdo**: dá pra mexer no texto, seções e layout sem tocar no repositório do
time de tecnologia.

## Arquivos

- `index.html` — a landing inteira, self-contained (uma página só).
- `assets/` — imagens/gifs usados pela página.

## Como pré-visualizar localmente

É só abrir o `index.html` no navegador. Como ele usa CDNs (Tailwind, fontes, animações),
**precisa de internet** pra estilizar. Pra evitar bloqueios de `file://`, rode um servidor:

```bash
# Python
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

## Como publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Selecione a branch (ex.: `main`) e a pasta **`/ (root)`**. Salve.
4. Em ~1 min a página fica no ar em `https://<seu-usuario>.github.io/boltenlanding/`.

## Notas técnicas

- Os CTAs (Cadastrar / Entrar / Montar plataforma) apontam para `#` de propósito — é um
  sandbox, não dispara cadastro nem conversão do app oficial.
- O estilo usa **Tailwind v4 (build de navegador via CDN)** + o tema de cores da marca
  (selva/tucano/ipê/tarde) embutido no `<head>`. Para produção, o ideal é compilar o
  Tailwind e servir um CSS estático (evita o flash inicial sem estilo).
- Bibliotecas via CDN: jQuery, GSAP, Chart.js, Alpine.js, AOS, Lucide.
