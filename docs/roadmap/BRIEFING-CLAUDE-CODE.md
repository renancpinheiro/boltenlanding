# Roadmap público dos partners: briefing para o Claude Code

Construir a página de novidades, roadmap e pedidos com votos dos partners da Bolten, o painel de aprovação do time e o servidor MCP que alimenta tudo. Substitui o Fider.

O arquivo `prototipo-roadmap.html` (nesta pasta) é a referência visual e de comportamento. Abra no navegador, troque PT/ES e alterne "Partner" / "Time" no topo para ver as duas visões. Os pedidos e votos dele são de exemplo; os lançamentos são reais (out–nov/2026).

## 1. Onde mora

A LP `partners.bolten.io` é o repositório `renancpinheiro/boltenlanding`: HTML estático, uma pasta por idioma (`/pt/`, `/es/`, `/en/`), deploy na Vercel com `trailingSlash: true` (ver `vercel.json`). DNS na Cloudflare, já apontado.

- Leia o repositório inteiro antes de escrever código e siga o padrão que existe (estrutura de pastas, como o idioma é escolhido no `index.html` raiz, tracking do PostHog/Meta/Google, rodapé).
- Confirme se há passo de build. No `main` não achamos `package.json`, então a premissa é **sem build**: HTML + JS puro + `supabase-js` via CDN com versão fixa. Se houver build, adapte.
- Rotas:
  - `/pt/roadmap/` e `/es/roadmap/`: página pública
  - `/en/roadmap/`: por enquanto redireciona para `/pt/roadmap/` (v1 é só PT e ES)
  - `/admin/roadmap/`: painel do time, `noindex`
- Link "Novidades e roadmap" no rodapé da LP, nos três idiomas.

## 2. Design

Seguir o design system Bolten (Felipe Ohira): `tokens.css` + `components/bundle.css`, já embutidos no protótipo. Copie os dois para `assets/` do repo e use as classes do sistema (`.tabs-list`, `.tab`, `.card`, `.btn`, `.status-pill`, `.tag`, `.segmented`, `.modal-*`, `.form-input`, `.toast`). O CSS próprio da página fica no bloco `app.css` do protótipo.

Regras que importam:

- Fundo `--surface-page`, superfícies brancas, texto em cinzas. Fonte Inter.
- **O laranja (`--tucano-400`) aparece em dois lugares só:** aba ativa e botão de voto marcado. Categorias ficam em tag neutra; cor fica para status.
- Status no roadmap: Planejado (cinza), Em construção (amarelo), Lançado (verde).
- Sem emoji na interface. Sentence case em títulos e botões.
- Responsivo até 360 px, foco visível, `prefers-reduced-motion` respeitado.

## 3. Página pública: três abas

**Lançamentos.** Agrupado por mês, mais recente primeiro. Rótulo do mês fixo à esquerda no desktop. Cada item: categoria, data, título, texto, mídia opcional (GIF ou MP4 em loop, sem som). Se veio de um pedido, mostrar "Pedido por N parceiros".
Suportar link direto por mês: `/pt/roadmap/#nov-26` rola até o mês (usado no e-mail mensal).

**Roadmap.** Três colunas: Planejado, Em construção, Lançado (últimos 90 dias). Card com título, categoria e votos. No celular vira uma coluna.

**Pedidos.**
- Campo "O que você gostaria de ver na Bolten?". A partir de 3 letras, busca pedidos parecidos (título e descrição, PT e ES, sem acento) e mostra até 3 com botão de votar. Abaixo: "Nenhum é o meu, criar pedido".
- Novo pedido em duas etapas:
  1. **Escrever.** Nome, e-mail e um campo livre: "Conte o que você precisa, do seu jeito". Sem formulário de campos; o partner escreve como quiser.
  2. **Revisar.** A IA reescreve o texto no padrão de pedido do time (ver seção 6) e mostra a versão formatada. O partner escolhe "Enviar assim" ou "Voltar e editar". Nada é gravado antes dele confirmar.
- Ao enviar, mostra "Recebemos o seu pedido" e explica que aparece depois de aprovado. O texto original do partner fica guardado junto, visível só para o time.
- **Comentários.** Clicar no título abre a conversa do pedido. Para comentar: nome, e-mail e texto, sem login. O e-mail nunca aparece na página. Comentário do time aparece com o selo "Time Bolten". Comentários aparecem na hora; o time pode apagar.
- Filtro por categoria. Lista ordenada por votos. Pedidos lançados saem da lista e ficam na aba Lançamentos.
- Voto: clicar marca, clicar de novo desmarca. 1 voto por item por navegador.

Idioma: tudo vem de um dicionário por idioma (o protótipo tem o `I18N` pronto). O conteúdo de itens e lançamentos vem do banco nos dois idiomas.

## 4. Painel do time (`/admin/roadmap/`)

- Login por link mágico do Supabase Auth, liberado só para quem está na tabela `admins` (Renan, Carlos, Enzo).
- **Aprovação:** lista de pedidos "em análise" com Aprovar, Recusar e "Mesclar com [item parecido]" (sugere o mais parecido; mesclar soma os votos no item de destino e marca o pedido como mesclado).
- **Editar:** só o time edita pedidos. Na própria página, logado, cada pedido ganha o botão "Editar" (título e descrição em PT e ES, categoria e status) e cada comentário ganha "Apagar". O time comenta sem preencher nome e e-mail.
- **Itens:** editar título/descrição nos dois idiomas, categoria e status. Mudar para "Lançado" pergunta se quer criar o lançamento já ligado ao item.
- **Lançamentos:** criar e editar, com upload de mídia no Supabase Storage.
- Qualquer um dos três aprova. Não há fila por pessoa.

## 5. Banco (Supabase, projeto novo)

```
itens
  id, titulo_pt, titulo_es, descricao_pt, descricao_es,
  categoria  -- crm | whatsapp | agente_ia | redes_sociais | conversoes | plataforma
  status     -- em_analise | aberto | planejado | em_construcao | lancado | recusado | mesclado
  mesclado_em (fk itens), criado_por_origem, criado_em, lancado_em

votos
  id, item_id, origem  -- pagina | call | whatsapp | slack | fider | notion
  partner_ref (texto, opcional), hash_navegador, hash_ip, criado_em
  unique (item_id, hash_navegador) where origem = 'pagina'

lancamentos
  id, data, titulo_pt, titulo_es, texto_pt, texto_es,
  categoria, midia_url, item_id (fk opcional), publicado (bool)

comentarios
  id, item_id, nome, email, texto, do_time (bool), user_id (quando do_time),
  hash_ip, criado_em, apagado_em

admins
  user_id (auth.users), nome, email
```

Em `itens`, guardar também `texto_original` (o que o partner escreveu antes da IA), `autor_nome` e `autor_email`.

- RLS: público lê `itens` com status `aberto | planejado | em_construcao | lancado` e `lancamentos` publicados. Público **não** escreve direto em nenhuma tabela.
- Escrita pública passa por Edge Functions:
  - `votar`: recebe item e id do navegador (UUID salvo no `localStorage`), grava `hash_navegador` e `hash_ip` (SHA-256 com sal em secret; o IP em claro nunca é salvo, por LGPD). Limite: 30 votos por IP por hora.
  - `formatar_pedido`: recebe o texto livre e devolve a versão formatada (não grava nada). Limite de 20 por IP por hora.
  - `criar_pedido`: grava a versão confirmada com status `em_analise`, mais o texto original. Limite de 5 pedidos por IP por dia. Captcha invisível (Cloudflare Turnstile).
  - `comentar`: grava nome, e-mail e texto. Limite de 10 comentários por IP por hora, mesmo captcha.
- Contagem de votos por view (`itens_com_votos`) para a página não somar no cliente.

## 6. IA que formata o pedido

O padrão do Fider é `[Categoria] Título curto` mais uma descrição de uma ou duas frases. Exemplos reais:

- `[WhatsApp] Follow up de inativação`: "Mensagem automática após falta de resposta."
- `[Agente de IA] Reconhecimento de Arquivo PDF`: "Ao receber arquivo PDF, verificar para enviarmos uma resposta padrão."

No sistema novo, o `[Categoria]` vira o campo `categoria` e sai do título. O partner não precisa digitar colchete nenhum; a IA tira isso do texto livre.

A Edge Function `formatar_pedido` chama a API do Claude e devolve JSON com três campos:

- `categoria`: uma das categorias da seção 5. Se não der para saber, usar a mais provável e deixar o partner trocar na revisão.
- `titulo`: curto, até 60 caracteres, começando pelo que a funcionalidade faz. Sem a categoria e sem ponto final.
- `descricao`: uma ou duas frases dizendo o que acontece e para quê.

Regras:
- Não inventa informação. Se o partner não disse para quê, a descrição diz só o quê.
- Escreve no idioma em que o partner escreveu. A tradução para o outro idioma acontece depois da aprovação (seção 7).
- A mesma função serve o MCP: pedido criado por call, WhatsApp ou Slack também passa por ela antes de gravar.

## 7. Tradução automática

Ao salvar item ou lançamento (painel ou MCP), se um idioma vier vazio, uma Edge Function chama a API do Claude e preenche o outro. Espanhol neutro da América Latina, tom direto, mesmo vocabulário da interface ES do app. O time revisa no painel; campo traduzido mostra o selo "Tradução automática" até alguém editar.

## 8. Servidor MCP

Edge Function no mesmo projeto, autenticada por chave de API (secret). Ferramentas:

| Ferramenta | Faz |
|---|---|
| `buscar_itens` | Busca por texto, categoria ou status. Usar antes de criar, para não duplicar. |
| `criar_pedido` | Cria item, passando pela formatação da seção 6. **Pelo MCP já entra aprovado** (status `aberto`), com origem. |
| `votar` | Soma voto com origem e `partner_ref` (ex.: call com fulano). |
| `mudar_status` | Muda status; ao lançar, oferece criar lançamento. |
| `mesclar` | Junta um item em outro e soma os votos. |
| `comentar` | Comenta num item como Time Bolten (ex.: resposta dada em call). |
| `aprovar` / `listar_pendentes` | Fila de pedidos vindos da página. |
| `criar_lancamento` | Cria lançamento, com ou sem item de origem. |
| `listar_lancados_do_mes` | Base do e-mail mensal (1ª sexta, Brevo). |

## 9. Migração

Script único que importa itens, votos e comentários do Fider e do Notion com `origem` marcada, mantendo as contagens. Nos títulos do Fider, o `[Categoria]` do começo vira o campo `categoria` e sai do título (ex.: `[Agente de IA] Reativar IA por Inatividade` vira categoria Agente de IA, título "Reativar IA por inatividade"). Títulos sem colchete passam pela `formatar_pedido`. Depois: desligar o Fider e apontar a rotina do #client-feedbacks para o MCP novo.

## 10. Ordem de entrega sugerida

1. Banco, RLS e as duas Edge Functions públicas
2. Página pública lendo do banco (PT e ES)
3. Comentários e IA de formatação
4. Painel do time e edição
5. MCP e tradução automática
6. Migração do Fider/Notion (com comentários) e link no rodapé

## Pendências


- Confirmar se o repo tem build ou é estático puro
- Criar o projeto Supabase e definir quem é dono
- Validar os nomes das categorias acima
- Revisar termos da interface em espanhol ("Archivados", "+ Registro") com o app ES

---

## Revisão visual (v2, 05/11/2026)

O protótipo foi redesenhado. Siga o arquivo prototipo-roadmap.html como referência visual, não a versão anterior.

- Fundo da página em surface-page; cartões só onde agrupam itens (roadmap, lista de pedidos, aprovação), com borda de 1px e raio de 12px, sem sombra.
- Topo enxuto: só logo, "Parceiros" e o seletor PT/ES. Nada de faixa colorida.
- Categoria é um ponto colorido com o nome ao lado, não uma pílula. Cores da paleta da marca: CRM areia-500, WhatsApp selva-400, Agente de IA ipe-400, Redes sociais tarde-400, Conversões lago-500, Plataforma gray-400.
- O laranja da marca aparece em três lugares só: sublinhado da aba ativa, marcador dos meses e estado "votado" do botão de voto.
- Lançamentos (Resumo): uma linha por mês com nome do mês à esquerda, lista no meio e o GIF do lançamento mais votado do mês à direita. "Em breve" no topo, com marcador vazado. Clicar num item ou no GIF abre o Detalhado já rolado até ele.
- Lançamentos (Detalhado): mês fixo à esquerda, cada lançamento com categoria, data, título, texto, "Pedido por N parceiros" quando houver, e a mídia (lancamentos.midia_url). Botão "Voltar ao resumo" no fim.
- Roadmap: a coluna Lançado mostra os 4 lançamentos mais recentes da tabela lancamentos e leva ao Detalhado.
- Pedidos: campo único "O que você gostaria de ver na Bolten?" com busca de parecidos enquanto digita.
- Aprovação: cada pedido mostra o "Texto original" que o partner escreveu (itens.texto_original), visível só para o time.
- A barra "Ver como Partner/Time" é só do protótipo. No produto, a visão do time é a rota /admin/roadmap/ com login.


### Linha do tempo horizontal (substitui o trilho vertical)
- Lançamentos > Resumo é uma linha do tempo **horizontal**: cada mês é uma coluna, do mais antigo (esquerda) ao futuro (direita), terminando em "Em breve".
- Trilho de 2px no topo ligando os marcadores. Meses lançados: ponto laranja e linha contínua. Último trecho até "Em breve": linha tracejada e ponto vazado.
- Dentro de cada coluna: nome do mês, contagem, lista de lançamentos (título, categoria, data) e logo abaixo o GIF do lançamento mais votado.
- Colunas com largura mínima de 260px; quando passarem da tela, a linha rola na horizontal (scroll-snap) e abre já posicionada no mês mais recente.
- No celular cada coluna ocupa 82% da largura, com a próxima aparecendo na borda para indicar que rola.
