# Bolten — Landing Page (réplica estática)

Réplica **estática e fiel** da landing page oficial da Bolten (versão pt), extraída do
app oficial (`bolten`, em `app/views/guests/home/bolten/pt`). Serve como **sandbox de
marketing/conteúdo**: dá pra mexer no texto, seções e layout sem tocar no repositório do
time de tecnologia.

## Arquivos

- `index.html` — a landing principal (parceiros white-label).
- `assets/` — imagens/gifs usados pelas páginas.

### Ecossistema de páginas

Além da home, o site tem sub-páginas auto-contidas (cada uma copia o mesmo shell:
`<head>`+tema, header e footer), conectadas à home nos dois sentidos:

- `para/agencias/`, `para/gestores-de-trafego/`, `para/contadores/` — LPs por nicho
  (message-match para campanhas de tráfego).
- `cases/` — cases de parceiros.
- `tour/` — tour do produto por módulo.
- `quanto-voce-ganha/` — calculadora de receita recorrente.
- `comparativo/` — Bolten vs. criar do zero / revender / outras white-label.
- `sobre/` — institucional / autoridade.
- `obrigado/` — página de pós-cadastro.

Os links internos são **relativos** e reescritos por profundidade, então funcionam
tanto na raiz quanto no subpath do GitHub Pages (`/boltenlanding/`). As sub-páginas
são geradas a partir do shell da home — ao mudar header/footer, regenere-as.

### Conteúdo a preencher (`[PREENCHER]` / `CONFIRMAR`)

Nenhum número foi inventado. Pesquise por `PREENCHER` e `CONFIRMAR` no código antes de
publicar de verdade:

- Total já pago a parceiros e logos de marcas (faixa de prova social da home).
- Cases reais: nicho, depoimento, faturamento, tempo, nome/foto (home e `cases/`).
- Depoimento em vídeo de parceiro.
- Tempo médio até o 1º cliente (FAQ).
- `CONFIRMAR` — texto de inadimplência no modo self-billing (FAQ) e o parágrafo
  institucional em `sobre/`.

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
- Só pt-BR por enquanto (o `<div id="js-locale" data-locale="pt">` é só um marcador —
  não há sistema de tradução no arquivo). Conteúdo novo fica pronto para traduzir depois.
