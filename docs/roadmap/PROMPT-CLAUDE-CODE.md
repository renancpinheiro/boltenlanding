# Prompt: roadmap público dos partners

Cole tudo abaixo no Claude Code, rodando dentro do repositório `renancpinheiro/boltenlanding`. Antes, coloque na raiz do repo, numa pasta `docs/roadmap/`, os dois arquivos que vão junto: `BRIEFING-CLAUDE-CODE.md` e `prototipo-roadmap.html`.

---

Vamos construir o roadmap público dos parceiros da Bolten neste repositório.

## Contexto e fontes

- `docs/roadmap/BRIEFING-CLAUDE-CODE.md` é a especificação completa: rotas, banco Supabase, Edge Functions, IA que formata pedidos, tradução, servidor MCP e decisões de design. Leia inteiro antes de começar. Em caso de conflito, a seção "Revisão visual (v2)" e a subseção "Linha do tempo horizontal" valem mais que as seções anteriores.
- `docs/roadmap/prototipo-roadmap.html` é o protótipo aprovado. Abra no navegador e use como referência visual e de comportamento (abas, Resumo e Detalhado, votos, novo pedido em duas etapas, visão Time). Ele tem dados fixos e GIFs embutidos em base64: não copie os dados nem os base64 para produção, só o layout, o CSS e a lógica de interface.
- O repo é HTML estático, sem framework e sem build, publicado na Vercel. Mantenha assim. Supabase via `supabase-js` por CDN, JS puro.

## Escopo desta rodada

### 1. Página do roadmap
Rotas `/pt/roadmap/`, `/es/roadmap/` e `/admin/roadmap/`, e `/en/roadmap/` redirecionando para `/pt/roadmap/`. Siga a ordem de entrega da seção 10 do briefing.

### 2. Ajustes de leitura pedidos depois do protótipo
- A página não precisa respeitar a largura do conteúdo atual do protótipo (~980px). Alargue a aba Lançamentos para um máximo de ~1200px, e no Resumo deixe a linha do tempo horizontal usar essa largura toda.
- Mais respiro: aumente o espaço entre colunas da linha do tempo (de 32px para 48px), entre itens de cada mês (de 20px para 28px) e entre o cabeçalho do mês e a lista.
- Em tela menor que 1200px, mantenha o comportamento do protótipo: colunas com largura mínima e rolagem horizontal começando no mês mais recente.

### 3. Link no rodapé
Adicione um link "Roadmap" no rodapé de todas as páginas do site. Em espanhol, também "Roadmap". Aponta para `/pt/roadmap/` nas páginas em português e para `/es/roadmap/` nas páginas em espanhol. Siga o padrão visual e de markup dos links que já existem no rodapé. Se o rodapé estiver repetido em vários arquivos HTML, altere todos e me mostre a lista de arquivos alterados.

### 4. Bloco de roadmap na home
Na home em PT e em ES, adicione uma seção curta que leva ao roadmap.
- Posição: escolha olhando a estrutura da home. Ela deve ficar perto do fim da página, depois do conteúdo de produto e antes do rodapé, sem quebrar a sequência de argumento de venda. Antes de implementar, me diga onde vai colocar e por quê.
- Conteúdo: um título curto, uma linha de apoio, os 3 lançamentos mais recentes (título, categoria com o ponto colorido e data) e um botão "Ver roadmap completo" / "Ver roadmap completo" em ES.
- Os lançamentos vêm da tabela `lancamentos` (só `publicado = true`, ordenados por `data` desc, limite 3), lidos com a chave pública e a RLS descrita no briefing. Cada lançamento clicado abre `/pt/roadmap/` (ou `/es/`) já no Detalhado, no lançamento certo.
- Se a consulta falhar ou demorar mais de 3 segundos, o bloco mostra só o título, a linha de apoio e o botão. Nunca deixe a seção quebrada ou com espaço vazio.
- Visual: use os estilos que a home já usa (tipografia, espaçamento entre seções, botões). Para o ponto de categoria, use as cores da seção "Revisão visual (v2)" do briefing.
- Me proponha 2 opções de título e linha de apoio em PT e ES antes de fechar.

## Regras

- Não invente dados. Onde faltar algo (conteúdo, credencial, decisão), pare e me pergunte. As pendências abertas estão no fim do briefing.
- O projeto Supabase ainda não existe. Comece pela parte que não depende dele (rodapé, estrutura das páginas, layout com dados de exemplo locais) e me avise quando precisar da URL e da chave pública.
- Nenhuma chave secreta (service role, chave da Anthropic, sal dos hashes) vai para o HTML ou para o repo. Elas ficam só nas Edge Functions.
- Textos visíveis em PT-BR e espanhol LATAM. Não use travessão (—) em nenhum texto da interface.
- Trabalhe numa branch nova e abra PR. Não faça push na main.
- Ao final de cada etapa, me mostre prints em 1440px e 390px de largura.
