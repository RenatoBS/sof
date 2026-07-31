# Decisões — Sof (ADR leve)

Documento vivo. **Toda decisão relevante entra aqui**, entrada mais recente no **topo**.

Formato sugerido:

```md
## YYYY-MM-DD — Título curto

- **Contexto:** …
- **Decisão:** …
- **Consequências:** …
- **Alternativas descartadas:** …
```

Índice geral: [`../AGENTS.md`](../AGENTS.md).

---

## 2026-07-31 — Ngrok: um túnel + reverse proxy (front+API mesma origem)

- **Contexto:** Acesso remoto ao Sof local (cloud VM / WhatsApp webhooks) precisa de HTTPS; free ngrok costuma limitar a um endpoint; Expo CorsMiddleware e Metro quebram com Host/`X-Forwarded-*` mal encaminhados.
- **Decisão:** `scripts/sof-dev-proxy.js` na `:9080` — `/api` → Nest `:3001`, resto → Expo `:8081`; `ngrok http 9080`; `EXPO_PUBLIC_API_URL` = URL pública (mesma origem). Proxy não usa `changeOrigin` no front e stripa `X-Forwarded-*`.
- **Consequências:** Login/dashboard/SSE pelo browser via um único HTTPS; CORS e cookies simplificados. Doc em `docs/local-development.md`.
- **Alternativas descartadas:** Dois túneis ngrok; só API no túnel; `changeOrigin` no front (quebra CORS do Expo).

## 2026-07-31 — Copy de confirmação: “Podemos agendar?” (não “Marcar”)

- **Contexto:** Site e bot usavam “marca/Marcar” no fluxo de agendamento; soava seco e fácil de confundir com outras ações (“marcar concluído”).
- **Decisão:** Confirmações do bot cliente/profissional e mock da landing passam a “Podemos agendar …?”; sucesso “Agendado.”; landing “agenda/agendam”. Mantém “Marcar como concluído/resolvido” e aceita “marca/marcar” como resposta afirmativa do usuário.
- **Consequências:** Tom mais alinhado à persona Sof; inventário em `docs/bot-messages.md` atualizado.
- **Alternativas descartadas:** Trocar só no site; banir “marcar” também no sense de concluir.

## 2026-07-31 — Faixa de ambiente (QA/local) no front produto

- **Contexto:** Em QA/local era fácil confundir a UI com produção; não havia sinal visual global.
- **Decisão:** `EnvStrip` no `app/_layout.tsx` (landing, dashboard e portal): faixa fina no topo, texto à direita; some em produção. Detecção: `EXPO_PUBLIC_APP_ENV` (build-time) + fallback hostname/`EXPO_PUBLIC_API_URL`.
- **Consequências:** QA/local ficam óbvios; prod limpo. Mudar a var no Heroku exige rebuild do web (`expo export`).
- **Alternativas descartadas:** Badge só no dashboard; ribbon diagonal; inferir só por `NODE_ENV` (QA e prod são `production`).

## 2026-07-30 — UI de `/docs` alinhada ao shell admin (lista + leitor)

- **Contexto:** Hub usava grid de cards com padding/maxWidth duplicados em relação ao shell; TOC do leitor não rolava até a seção; tabelas Markdown estouravam o layout.
- **Decisão:** Hub com `ListRow` (mesmo padrão de Contas/Planos); leitor com artigo único + TOC clicável (scroll no web); `MarkdownDoc` com scroll horizontal em tabelas, `nativeID` nos headings e strip do H1 (já no header).
- **Consequências:** Docs internas visualmente coerentes com o painel; TOC útil no desktop.
- **Alternativas descartadas:** Manter cards; TOC só decorativo; renderizar MD como HTML isolado.

## 2026-07-30 — Documentação interativa no painel-admin (`/docs`)

- **Contexto:** Markdowns vivos em `docs/` só existiam no Git; o admin só tinha guias HTML públicos para o cliente.
- **Decisão:** Área autenticada `/docs` no shell admin com hub pesquisável + leitor Markdown; `sync-docs.js` copia `docs/*.md` → `public/internal-docs/` (+ `manifest.json`); build `sync-content`; guias HTML públicos permanecem em `/guides`.
- **Consequências:** Time Sof lê a mesma doc da IA no painel; Heroku exige `public/internal-docs` commitado; agentes devem sync após mudar MD.
- **Alternativas descartadas:** Exigir login nos HTML de cliente; servir MD só do monorepo no Heroku; editar docs pelo painel.

## 2026-07-30 — Bot WhatsApp não menciona plano ao interlocutor

- **Contexto:** Mensagens de gate (áudio, marcar/bloquear no bot do prof) citavam “seu plano não inclui…”.
- **Decisão:** Copy neutra em `bot-copy.ts` — orientar a ação sem falar de plano/upgrade; enforcement continua no backend.
- **Consequências:** Cliente e profissional no WA não veem comercial/entitlement; dono vê limites no painel/admin.
- **Alternativas descartadas:** Manter menção a plano; CTA de upgrade no WhatsApp.

## 2026-07-30 — Persona verbal Sof no bot WhatsApp

- **Contexto:** Mensagens do bot estavam espalhadas e com tom inconsistente (exclamações, emoji no áudio, “Combinado”, “salão”); sof.solutions pede leveza com calma e sofisticação.
- **Decisão:** Documentar persona em `docs/brand.md` (pilares Leveza / Confiança / Proximidade + calma e sofisticação) e centralizar copy em `saas/backend/src/whatsapp/bot-copy.ts`, usada pelo fluxo cliente/profissional, controller, lembretes, notify e reset de senha. Léxico: “Certo”, “Marcado.”, “Não entendi.”, sem emoji.
- **Consequências:** Uma fonte de verdade para voz; NLU continua só extração JSON (não gera copy). Persona global, não por tenant.
- **Alternativas descartadas:** LLM gerando respostas com system prompt de persona; CMS/i18n; persona custom por conta.

## 2026-07-30 — Apps Heroku renomeados para `sof-solutions-*`

- **Contexto:** Apps ainda usavam o prefixo legado `sof-solutions-*`.
- **Decisão:** Renomear os 6 apps para `sof-solutions-{api,web,admin-api,admin-web,api-qa,web-qa}`. Domínios custom (`api`/`www`/`qa`/`painel-admin`) permanecem; hostnames `*.herokuapp.com` mudam — atualizar `EXPO_PUBLIC_API_URL` onde apontava ao host Heroku e redeployar o front correspondente.
- **Consequências:** Remotes git e docs/scripts atualizados; URLs Heroku antigas deixam de ser canônicas.
- **Alternativas descartadas:** Manter nomes antigos; renomear só QA.

## 2026-07-30 — Domínio QA API `qa-api.sof.solutions`

- **Contexto:** API QA só no hostname Heroku; rename de apps quebrava `EXPO_PUBLIC_API_URL` embutido no front.
- **Decisão:** Custom domain no `sof-solutions-api-qa`; CNAME `qa-api` → target Heroku; `API_PUBLIC_URL` + `EXPO_PUBLIC_API_URL` = `https://qa-api.sof.solutions` (redeploy do web QA).
- **Consequências:** Webhooks e front QA estáveis independentemente do slug Heroku.
- **Alternativas descartadas:** Manter só `*.herokuapp.com`; path no mesmo host `qa`.

## 2026-07-30 — Domínio QA `qa.sof.solutions`

- **Contexto:** Web QA só em `*.herokuapp.com`.
- **Decisão:** Custom domain no `sof-solutions-web-qa`; CNAME Hostinger `qa` → target Heroku DNS; API QA usa `PUBLIC_URL`/`CORS_ORIGIN` = `https://qa.sof.solutions`. API continua no hostname Heroku até haver subdomínio dedicado.
- **Consequências:** Certificado ACM após DNS propagar; `heroku:qa:config` prefere o domínio custom.
- **Alternativas descartadas:** `www-qa`; apontar API e web no mesmo host.

## 2026-07-30 — Ambiente QA SaaS (Heroku + Supabase staging)

- **Contexto:** Precisávamos de um ambiente isolado do produto (sem admin) para validar com banco/Stripe/Uazapi de staging.
- **Decisão:** Apps `sof-solutions-api-qa` + `sof-solutions-web-qa`; envs a partir de `saas/backend/.env.qa` via `npm run heroku:qa:config` (URLs Heroku sobrescrevem localhost do arquivo); deploy com `npm run deploy:qa`.
- **Consequências:** Postgres staging separado da prod; admin continua só em produção.
- **Alternativas descartadas:** Reusar apps de prod com review apps; incluir admin no QA agora.

## 2026-07-30 — Prisma `adminClient` não escreve fora do slug Heroku

- **Contexto:** Com `APP_BASE=saas/backend`, `prisma generate` tentava `../../../admin/backend/...` → `EACCES mkdir /admin`.
- **Decisão:** `heroku-postbuild` usa `prisma generate --generator client`; output do `adminClient` fica em `saas/backend/node_modules/.prisma/admin-client`. Admin continua com sync-schema + generate próprio.
- **Consequências:** Deploy da API produto não depende da pasta `admin/`.
- **Alternativas descartadas:** Remover `adminClient` do schema; copiar `admin/` para o slug da API.

## 2026-07-30 — Monorepo em `saas/` + `admin/`

- **Contexto:** Quatro apps na raiz (`backend`, `frontend`, `admin-backend`, `admin-frontend`) misturavam produto e painel interno.
- **Decisão:** Produto em `saas/backend` + `saas/frontend`; painel em `admin/backend` + `admin/frontend` (sem prefixo `admin-` nos nomes das pastas). Scripts npm da raiz mantêm aliases (`backend:dev`, `admin-backend:dev`) com `--prefix` novo. Heroku `APP_BASE` aponta para os subpaths.
- **Consequências:** Prisma `adminClient` output em `admin/backend/...`; `sync-guides` sobe dois níveis até a raiz; docs/AGENTS atualizados.
- **Alternativas descartadas:** Manter pastas planas; `packages/*` estilo turborepo (overkill agora).

## 2026-07-29 — Ops WhatsApp (Uazapi) no painel admin

- **Contexto:** Suporte precisava desconectar/reconectar/recriar instâncias sem entrar no console Uazapi nem no painel do tenant.
- **Decisão:** Endpoints admin `GET/POST /api/accounts/:id/whatsapp*` + UI em `/edit-account` (status, QR/código, disconnect, clear, recreate). Admin-api usa as mesmas envs Uazapi; webhook permanece na API produto (`API_PUBLIC_URL`). Token da instância não vai ao front.
- **Consequências:** Admin-api precisa de `WHATSAPP_*` + `API_PUBLIC_URL`; badge WA na lista de contas.
- **Alternativas descartadas:** Proxy para o painel Uazapi; console completo (envio de msgs, chats); só leitura de status.

## 2026-07-29 — Rotas do frontend em inglês

- **Contexto:** Mix de paths PT (`/simulador`, `/esqueci-senha`, `/profissional/…`) e EN (`/account`, `/employees`) no export estático.
- **Decisão:** Paths canônicos em inglês (`/simulator`, `/forgot-password`, `/set-password`, `/employee/*`, `/(employee)/change-password`); stubs de redirect nas URLs antigas; e-mails de reset usam as novas URLs.
- **Consequências:** Sitemap/export coerente; links antigos em e-mail/WhatsApp ainda resolvem via redirect.
- **Alternativas descartadas:** Manter PT só no portal do profissional; quebrar links antigos sem redirect.

## 2026-07-29 — Simulador WhatsApp fora da Agenda (`noindex`)

- **Contexto:** O bloco do simulador pesava a Agenda (superfície principal) e não precisava de discoverability em busca/nav.
- **Decisão:** Página `/(dashboard)/simulator` com `robots: noindex,nofollow`, fora das tabs; botão só na Conta (seção WhatsApp) enquanto `!waLinked`; rota aberta se acessada direto.
- **Consequências:** Demo/teste do bot continua via auth; URL direta `/simulator`.
- **Alternativas descartadas:** Manter embutido na Agenda; tab dedicada na nav; esconder a rota quando conectado.

## 2026-07-29 — Guias HTML por plano (Solo / Equipe / Rede)

- **Contexto:** Onboarding citava os planos sem detalhar funções; cliente e vendas precisavam de material compartilhavel por plano.
- **Decisão:** Um HTML por plano (`plano-solo|equipe|rede.html`) + `docs/planos-funcoes.md`; hub `/guides` lista os três; sync-guides copia os HTMLs; nav cruzada nos guias existentes.
- **Consequências:** Conteúdo alinhado a `PLAN_ENTITLEMENT_DEFAULTS` / marketing de `plans.ts`; admin pode divergir via matriz — doc avisa.
- **Alternativas descartadas:** Um único PDF; só tabela no pricing sem guia dedicado.

## 2026-07-29 — Alterar plano na Conta via modal

- **Contexto:** Conta já edita estabelecimento e horário em modal; “Alterar plano” navegava para tela cheia.
- **Decisão:** CTA abre `ChoosePlanModal` (mesmo fluxo cupom/checkout); rota `choose-plan` fica só para gate de conta pausada/`needsPlanSelection`.
- **Consequências:** troca de plano sem sair da Conta; após cupom/demo o modal fecha e o banner de Assinatura atualiza.
- **Alternativas descartadas:** manter navegação para `choose-plan` também no caso de conta ativa.

---

---

---

---

---

## 2026-07-29 — Domínio custom do painel admin

- **Contexto:** Admin web só em `*.herokuapp.com`; produto já usa `*.sof.solutions` (Hostinger → Heroku DNS).
- **Decisão:** `painel-admin.sof.solutions` → `sof-solutions-admin-web`; `PUBLIC_URL`/`CORS_ORIGIN` da admin-api apontam para o novo host (mantém URL Heroku no CORS na transição). API admin permanece no host Heroku por enquanto.
- **Consequências:** CNAME na Hostinger + ACM; SSL só após DNS propagar.
- **Alternativas descartadas:** `admin.sof.solutions` (menos descritivo); domínio só na API admin.

## 2026-07-29 — Conta: colunas explícitas + sem card Sair

- **Contexto:** `flexWrap` deixava gap enorme sob Assinatura quando WhatsApp era mais alto; card “Sair da conta” duplicava o logout do header.
- **Decisão:** layout wide em duas colunas com gap uniforme; logout só no shell do painel.
- **Consequências:** espaçamento previsível; menos ruído na Conta.
- **Alternativas descartadas:** masonry CSS / manter wrap com alinhamento artificial.

## 2026-07-29 — Bot Solo: awaiting_employee sem horário (loop)

- **Contexto:** Planos sem `bookingPathChoice` (Solo) gravavam `awaiting_employee` só com `serviceId`. O handler de `awaiting_employee` exigia `date`+`time` e caía em `pathMenu` de novo → cliente recebia “Não entendi” / menu repetido ao escolher profissional.
- **Decisão:** Pré-horário sempre usa step `awaiting_path`; sessões legadas sem slot no `awaiting_employee` resolvem profissional e seguem para `dayMenu`.
- **Consequências:** Agendamento Solo volta a avançar após escolher o profissional.
- **Alternativas descartadas:** Manter dois steps distintos com handlers separados só para Solo.

## 2026-07-29 — Guias admin: prints Conta/modais atualizados

- **Contexto:** Prints do onboarding no admin-web mostravam Conta antiga (formulário inline, botão Escanear QR) e CRUD sem modal.
- **Decisão:** Recapturar `07-conta`, `07b`, `07c`, serviços e profissionais; alinhar copy do MD/HTML; `sync-guides` → `admin-frontend/public/guides`.
- **Consequências:** Material público `/guides` reflete grade 2 colunas, QR automático e modais.
- **Alternativas descartadas:** Manter prints antigos com nota de “UI em mudança”.

## 2026-07-29 — Conta: QR WhatsApp aberto e auto-refresh

- **Contexto:** O pareamento exigia clicar em “Escanear QR”; o código expirava sem renovação clara.
- **Decisão:** Com pairing disponível e dispositivo desconectado, chamar `connect` automaticamente e exibir o QR; poll de status atualiza a imagem e, se o QR sumir ou passar ~45s, regenera em silêncio. “Usar código” continua opcional.
- **Consequências:** Menos fricção no onboarding; mais chamadas a `POST /account/whatsapp/connect` enquanto a aba Conta estiver aberta sem parear.
- **Alternativas descartadas:** Manter botão manual; só confiar no QR do `GET /status` sem reconnect.

## 2026-07-29 — Conta: grade 2 colunas + modais de edição

- **Contexto:** A tela Conta empilhava formulários longos (logo, contato, horário expandível) e desperdiçava largura em monitores grandes.  
- **Decisão:** Em ≥ 900px, conteúdo centralizado (`maxWidth` ~1040) com grid de até 2 cards/linha (Estabelecimento|Horário, Assinatura|WhatsApp, Lembretes|Ajuda). Edição de estabelecimento e horário sai da página para `EstablishmentModal` / `OpeningHoursModal`; cards ficam resumo + `SofIconAction` edit.  
- **Consequências:** Página mais escaneável no desktop; WhatsApp/lembretes/pausa/logout intactos na página.  
- **Alternativas descartadas:** Manter formulários inline; três colunas; accordion de horário na página.

---

## 2026-07-29 — CRUD serviço/prof/cliente em modal (padrão agenda)

- **Contexto:** Formulários inline na página duplicavam Cancelar e quebravam o padrão visual da agenda.  
- **Decisão:** `EntityFormModal` + `ServiceFormModal` / `EmployeeFormModal` / `ClientFormModal` no mesmo shell do `AppointmentModal` (overlay, Salvar/Fechar).  
- **Consequências:** Lista fica só cards; header só com “Adicionar …”.  
- **Alternativas descartadas:** Manter form inline com X no header.

---

## 2026-07-29 — Home: preço “a partir” dinâmico e copy “negócio”

- **Contexto:** Hero da home ainda dizia “A partir de R$ 99” (catálogo antigo) e falava em “salão”.  
- **Decisão:** Nota de preço lê o menor `Plan.price` via `GET /api/plans` (fallback Solo R$ 139); copy marketing usa “negócio” no lugar de “salão”.  
- **Consequências:** Preço da home acompanha o catálogo admin/Stripe.  
- **Alternativas descartadas:** Hardcode do novo valor sem API.

---

## 2026-07-29 — Guias do cliente públicos no admin-web

- **Contexto:** HTML de onboarding/bot existia só em `docs/guides/`; precisava de URL estável sem login para enviar ao cliente.  
- **Decisão:** Publicar em `admin-frontend/public/guides/` (sync no `export:web`); rotas Expo públicas `/guides`, `/guides/onboarding`, `/guides/bot` (fora do `(shell)`); hub lista os links; nav **Guias** abre em nova aba.  
- **Consequências:** URLs no admin Heroku (ex. `…/guides/onboarding`); fonte continua em `docs/` + `npm run sync-guides`. No Heroku o monorepo só envia `admin-frontend/` — o sync no-op e usa `public/guides` commitado.  
- **Alternativas descartadas:** Hospedar no front de produto; exigir login admin para ler o guia; buildpack que copie `docs/` para o slug.

---

## 2026-07-29 — Guias HTML para o cliente (onboarding + bot)

- **Contexto:** O markdown de onboarding serve bem no repo, mas o cliente precisa de páginas HTML compartilháveis; faltava material do bot (fluxo cliente vs profissional).  
- **Decisão:** `docs/guides/onboarding-cliente.html` + `docs/guides/bot-whatsapp.html` + CSS compartilhado (`sof-guides.css`); tipografia Literata (títulos) + Hanken Grotesk (corpo); prints em `assets/onboarding/`.  
- **Consequências:** Abrir os HTML a partir de `docs/guides/` (paths relativos das imagens). Markdown permanece como fonte espelhada.  
- **Alternativas descartadas:** PDF gerado; hospedar só no site marketing nesta entrega.

---

## 2026-07-29 — Guia de onboarding do cliente com prints

- **Contexto:** Faltava material único (plano/cupom → cadastros → WhatsApp) para entregar ao cliente, com referência visual das telas reais.  
- **Decisão:** Criar [`docs/onboarding-cliente.md`](onboarding-cliente.md) + prints em `docs/assets/onboarding/` capturados do produto em produção; indexar em `AGENTS.md` e referenciar em `features.md`.  
- **Consequências:** Onboarding versionado no repo; atualizar prints quando a UI mudar de forma relevante.  
- **Alternativas descartadas:** Só Notion/PDF fora do repo; canvas interno sem assets versionados.

---

## 2026-07-29 — Admin: contas por cupom e por plano

- **Contexto:** Admin só mostrava `usedCount` do cupom e o plano na linha da conta — sem lista de quem resgatou nem filtro/contagem por plano.  
- **Decisão:** `GET /api/coupons/:id` inclui `redemptions` (conta + datas); `GET /api/plans` inclui `accountCount`; `GET /api/accounts?planId=` filtra; UI em `/edit-coupon`, `/plans`, `/edit-plan` e filtro em `/accounts`.  
- **Consequências:** Visibilidade operacional sem query no banco; `billingSource`/`promoExpiresAt` no shape da conta admin.  
- **Alternativas descartadas:** Dashboard analytics separado; endpoint novo só de redemptions.

---

## 2026-07-29 — E-mail SMTP (Gmail) + reset conta + boas-vindas

- **Contexto:** Sem canal de e-mail; reset só WhatsApp (profissional); conta dona sem “esqueci senha”; pós-checkout sem boas-vindas.  
- **Decisão:** `MailModule` (nodemailer + `SMTP_*`/`MAIL_FROM`); esqueci senha unificado (conta/prof) via e-mail + WhatsApp; link do profissional pelo painel continua **só WhatsApp**; tickets sem e-mail; boas-vindas no `provisionAccount` (nova conta).  
- **Consequências:** `AccountPasswordToken`; páginas `/forgot-password` e `/set-password`; Gmail App Password ok para MVP (limites de volume).  
- **Alternativas descartadas:** Resend/SendGrid já no MVP; e-mail no convite do profissional pelo painel.

---

## 2026-07-29 — Ícones na tabbar do painel

- **Contexto:** Menu superior só com texto; 7 abas com scroll horizontal no mobile.  
- **Decisão:** Ícone SVG line + label em cada aba (`DashboardTabIcon`); ativo em verde (`d.accent`), inativo em cinza.  
- **Consequências:** Scan mais rápido; badge de Atendimentos mantido ao lado do label.  
- **Alternativas descartadas:** Só ícone; biblioteca externa de ícones.

---

## 2026-07-28 — Conta sem dados duplicados

- **Contexto:** Perfil repetia e-mail/plano/WhatsApp/telefone/endereço já presentes no header, Assinatura, WhatsApp e formulário de contato.  
- **Decisão:** Assinatura só comercial; um card Estabelecimento com logo+identidade+contato+horário; e-mail só no header; WA só na seção WhatsApp.  
- **Consequências:** Menos scroll e scan mais claro.  
- **Alternativas descartadas:** Manter hero + chips de status.

---

## 2026-07-28 — Cor do profissional: qualquer hex + seletor

- **Contexto:** API só aceitava 6 hex fixos (Tailwind); o form do painel já usava presets da marca Sof — salvar/editar falhava com “Cor inválida”.  
- **Decisão:** backend valida qualquer `#RGB`/`#RRGGBB`; front mantém presets e adiciona `input type=color` (web) / campo hex (nativo).  
- **Consequências:** cores livres na agenda; defaults de criação alinhados à paleta Sof.  
- **Alternativas descartadas:** só expandir a whitelist de presets.

---

## 2026-07-28 — Conta: card de perfil do estabelecimento

- **Contexto:** Bloco do estabelecimento na Conta misturava logo, nome e ações sem hierarquia clara; seções usavam `View` card legado inconsistente com o kit.  
- **Decisão:** Card de perfil (`SofCard`) com logo clicável, kicker, chips (`EntityChip`), preview de telefone/endereço e rodapé de ações de logo; Assinatura / Dados / WhatsApp / Lembretes / Ajuda em `SofCard`.  
- **Consequências:** Conta mais scannable e alinhada às listagens Operate.  
- **Alternativas descartadas:** Manter layout flat; página só com formulários sem hero.

---

## 2026-07-28 — Cards entity (Profissionais / Serviços / Clientes)

- **Contexto:** Cards das três listagens eram blocos de texto plano com ações soltas; pouca hierarquia e empty fraco em profissionais.  
- **Decisão:** Primitivos `EntityAvatar` / `EntityStat` / `EntityChip` / footer em `features/dashboard/EntityCard.tsx`; cards com avatar, meta rotulada, chips e rodapé de ações; contagem no header; empty state em profissionais.  
- **Consequências:** Visual Operate mais scannable e consistente entre as três telas.  
- **Alternativas descartadas:** Tabela densa; redesign total da IA.

---

## 2026-07-28 — Logo do estabelecimento em base64 (≤5 MB)

- **Contexto:** Dono precisa de identidade visual no painel; storage de objetos (S3/Blob) ainda não está no stack.  
- **Decisão:** Campo `Account.logoBase64` (TEXT, data URL); upload na Conta com compressão client-side até 5 MB; validação server-side; limite JSON da API `8mb`; logo no header do dashboard e do portal profissional.  
- **Consequências:** Payloads de `auth/me` e `PUT /account` ficam maiores quando há logo; solução temporária até object storage.  
- **Alternativas descartadas:** Upload multipart para disco local; S3 agora; só URL externa.

---

## 2026-07-28 — Editar/Remover com ícone responsivo

- **Contexto:** Links “Editar”/“Remover” nos cards de Serviços, Clientes e Profissionais ocupavam espaço em mobile e não tinham affordance visual clara.  
- **Decisão:** `SofIconAction` + `SofRowActions` no kit compartilhado — ícone SVG + label; viewport &lt; 720px mostra só o ícone (com `accessibilityLabel`).  
- **Consequências:** Únicas telas com esse padrão no front produto; modal de agenda mantém `SofButton` de exclusão (ação destrutiva com copy completa).  
- **Alternativas descartadas:** Sempre só ícone; ícones emoji; breakpoint por largura do card.

---

## 2026-07-28 — Paleta Sof da logo (verde floresta + cobre)

- **Contexto:** Identidade visual oficial (SOF + “AGENDA · CONVERSA · CONECTA”) usa fundo verde floresta e pontos cobre; o produto ainda tinha lavender marketing e azul Tailwind no dashboard.  
- **Decisão:** Tokens `m`/`d` (e admin) passam a `#3D4743` (accent) + `#C19A6B` (copper); fundos permanecem claros (`#F4F4F6` / branco). Wordmark usa ponto cobre; plano featured e eyebrows usam cobre; CTAs/ícones usam verde.  
- **Consequências:** Marketing, painel e admin compartilham a mesma cromia; WhatsApp green (`waGreen`) permanece só para estados WA.  
- **Alternativas descartadas:** Fundo verde escuro na UI (pedido: manter branco/cinza); manter azul Operate separado.

---

## 2026-07-28 — Polish UI/UX produto com Impeccable (shared layer)

- **Contexto:** Skills Impeccable + frontend-design pediam polish de todas as páginas; o painel repetia card/header/empty e o marketing perdia links no mobile. Redesign completo quebraria a identidade dual (lavender marketing vs Operate dashboard).  
- **Decisão:** Refinar o sistema compartilhado (`SofCard`, `SofPageHeader`, `SofEmptyState`, `SofErrorBanner`, `SofAuthCard`, `SofLoadingGate`, press/`loading` em botões, tipografia Hanken no dashboard) e migrar telas para esses primitivos; menu mobile na `MarketingNav`; toast dismissível. Conta/Agenda receberam tipografia/sombra sem reescrever fluxos densos. Admin polish isolado (ADR própria).  
- **Consequências:** Hierarquia e estados consistentes em marketing + painel + profissional; Conta e agendas ainda têm padrões locais de domínio. `/impeccable init` ainda recomendado para PRODUCT.md.  
- **Alternativas descartadas:** Redesign unificando accent do dashboard no lavender (mudaria Operate); unificar UI kit admin↔produto.

---

## 2026-07-28 — Polish do painel admin com UI kit próprio

- **Contexto:** `admin-frontend` tinha telas de listagem (contas, tickets, planos, cupons) com cabeçalho, busca, linhas e vazio reimplementados manualmente em cada arquivo; `Button` não tinha estado de loading/hover e a nav do shell não escalava bem em telas estreitas.
- **Decisão:** Expandir `src/theme/admin.ts` (radius, shadow.soft, fonts nas mesmas famílias Hanken/Inter do produto, dangerSoft, fill) e `src/components/ui.tsx` (Button com loading/size/hover-pressed; novos `PageHeader`, `ListRow`, `EmptyState`, `ErrorText`, `SearchField`). Migrar as 4 listagens e o login (card com `shadow.soft`) para esses componentes; nos formulários, trocar só o texto de erro por `ErrorText` e o texto "Salvando…/Criando…" por `Button loading`, sem tocar na lógica. Nav do shell (`(shell)/_layout.tsx`) ganhou `ScrollView` horizontal para os links e estado hover/pressed.
- **Consequências:** Continua um pacote de UI **isolado** do `frontend/` (nenhum import cruzado) — reaproveita só os nomes de fontes Google já carregadas nos dois apps. Em telas com múltiplas ações sob o mesmo `busy` (ex.: salvar+resetar senha em `edit-account`, salvar+sincronizar+apagar em `edit-plan`), manteve-se `disabled`+texto dinâmico em vez de `loading` para não acender spinner num botão que não é o da ação em andamento.
- **Alternativas descartadas:** Compartilhar componentes com `frontend/src/components/ui.tsx` (rejeitado — admin é pacote isolado por design); usar `loading` em todos os botões de telas multi-ação (rejeitado — spinner enganoso em botão inativo).

---

## 2026-07-28 — Polish das telas de auth/marketing com componentes compartilhados

- **Contexto:** `login.tsx`, `esqueci-senha.tsx`, `definir-senha.tsx`, `checkout-return.tsx`, `+not-found.tsx`, `trocar-senha.tsx` e `choose-plan.tsx` tinham cartões, banners de erro e botões de loading reimplementados à mão (cores, radius e texto de loading variavam tela a tela), divergindo de `SofAuthCard`/`SofErrorBanner`/`SofButton`/`SofCard`/`SofPageHeader` já usados no restante do produto.
- **Decisão:** Migrar essas telas para os componentes compartilhados de `frontend/src/components/ui.tsx`; `definir-senha.tsx` passou do tema `dashboard` para `marketing` (fica lado a lado de login/esqueci-senha como parte do funil de auth); `checkout-return.tsx` ganhou `MarketingNav`/`SiteFooter`; `+not-found.tsx` ganhou `Wordmark` + `SofButton`.
- **Consequências:** Banner de erro agora usa sempre a cor de `SofErrorBanner` (tokens do tema dashboard) mesmo em telas de marketing, substituindo o vermelho quente (`m.danger`) que essas telas usavam antes — leve mudança visual, mas consistente em todo o app. Botões de loading passaram a usar título estático + spinner (prop `loading`) em vez de trocar o texto ("Entrando…", "Salvando…"), padronizando com o resto do dashboard.
- **Alternativas descartadas:** Manter estilos locais por tela (mais divergência visual); criar uma variante de `SofErrorBanner` por tema (mais um eixo de configuração para um componente que deveria ser neutro).

---

## 2026-07-28 — Skills Cursor Impeccable + frontend-design

- **Contexto:** Agentes geravam UI genérica (“AI slop”) sem vocabulário de design consistente no monorepo.  
- **Decisão:** Versionar no repo `.cursor/skills/impeccable` (v4) e `.cursor/skills/frontend-design` (Anthropic), com hook `preToolUse` do detector Impeccable.  
- **Consequências:** Agent Skills no Cursor usam `/impeccable` (audit, polish, typeset…) e a skill Anthropic em tarefas de UI; detector pode bloquear padrões ruins antes do write.  
- **Alternativas descartadas:** Só regras em user rules; UI Skills / Taste Skills sem Impeccable; instalar só global sem versionar no repo.

---

## 2026-07-28 — `deploy:together` (API + front em paralelo)

- **Contexto:** `npm run deploy` publica API e depois front; quem quer ambos ao mesmo tempo precisava de dois terminais.  
- **Decisão:** Script `scripts/deploy-together.sh` + `npm run deploy:together` faz `git push` paralelo para `heroku-api` e `heroku-web`, agrega logs e falha se qualquer um falhar. `deploy` sequencial permanece.  
- **Consequências:** Builds Heroku sobem juntos; tempo de parede menor. Se a API falhar, o front ainda pode ter sido aceito (checar logs).  
- **Alternativas descartadas:** Só alias de `deploy`; forçar paralelo no `deploy` padrão (quebra expectativa api-first).

---

## 2026-07-28 — Máscara e validação em Clientes e Profissionais

- **Contexto:** Forms de cliente/profissional (e cadastro rápido na agenda) sem máscara de telefone e com validação fraca ou só mensagem genérica.  
- **Decisão:** Reusar `maskBrPhone` + `validateClientFields` / `validateEmployeeFields` em `clients.tsx`, `employees.tsx` e `ClientPicker`; erros por campo no `SofInput`.  
- **Consequências:** Mesmo padrão do checkout/Conta; telefone exibido formatado nos cards de profissional.  
- **Alternativas descartadas:** Validar só no backend; máscara só na listagem.

---

## 2026-07-28 — Conta: máscara de telefone, save único, gate WA

- **Contexto:** Telefone na Conta sem máscara; pausa do bot e lembretes apareciam sem WhatsApp conectado; telefone e endereço tinham botões separados.  
- **Decisão:** Máscara BR `(DD) NNNNN-NNNN` no input; um botão Salvar envia `phone`+`address`; seções pausa/lembretes só com `waLinked` (+ entitlements).  
- **Consequências:** UI coerente com o estado real da integração; menos cliques no cadastro do estabelecimento.  
- **Alternativas descartadas:** Manter saves separados; esconder só via entitlement.

---

## 2026-07-28 — Validação de cadastro de conta no front

- **Contexto:** CheckoutModal só desabilitava o botão sem feedback; e-mail não era checado; admin Nova conta e Conta (telefone/horários) iam direto à API.  
- **Decisão:** Helpers em `frontend/src/lib/validation.ts` espelhando backend; `SofInput`/`Field` com prop `error`; validação por campo no submit (checkout, admin nova conta, telefone/horários na Conta). Botão permanece clicável para exibir erros.  
- **Consequências:** Usuário vê o que corrigir antes do round-trip; backend continua como fonte de verdade.  
- **Alternativas descartadas:** Manter só `disabled` silencioso; biblioteca de forms pesada.

---

## 2026-07-28 — Conta: UI por seções + hero do estabelecimento

- **Contexto:** A tela Conta era uma pilha longa de cards sem hierarquia (telefone/endereço separados, status WhatsApp só em texto, logout como card).  
- **Decisão:** Hero com iniciais/nome/plano/status WA; labels de seção; telefone+endereço no mesmo card; preview de expediente com pills Dom–Sáb; status servidor/dispositivo em cards; logout em zona de sessão no rodapé. Tokens e componentes do dashboard (`d`, `SofButton`/`SofInput`) mantidos.  
- **Consequências:** Mesmo contrato de API e comportamento; navegação visual mais clara sem mudar fluxos.  
- **Alternativas descartadas:** Tabs internas (mais estado); redesign fora do design system do painel.

---

## 2026-07-28 — Sync Stripe de planos seed + Payment Link alinhado ao preço

- **Contexto:** Planos Solo/Equipe/Rede no DB tinham `stripeProductId=seed_*` e Payment Links/Prices antigos (R$99/197/249) enquanto o catálogo mostrava R$139/199/259; Solo sem link; seed sobrescrevia IDs Stripe; save no admin sempre mandava `paymentLinkUrl` e bloqueava regeneração.  
- **Decisão:** `syncPlanCatalog` cria/reusa Product+Price+Payment Link pelo preço do Sof; `POST /api/plans/:id/sync-stripe` + botão no admin; update sincroniza também planos `seed_*` / link vazio; seed **não** sobrescreve campos Stripe no update.  
- **Consequências:** Checkout e Payment Links passam a cobrar o valor do plano; admin pode re-sincronizar a qualquer momento.  
- **Alternativas descartadas:** Corrigir só à mão no Dashboard Stripe; manter Prices legados.

---

## 2026-07-28 — Cupons promocionais (dias grátis sem Stripe)

- **Contexto:** Precisávamos dar 7/30/60 dias grátis de um plano selecionado, com limite de usos, sem passar pelo Checkout Stripe; ao vencer, a conta pausa e o dono escolhe plano de novo.  
- **Decisão:** Modelos `PromoCoupon` + `PromoCouponRedemption`; admin CRUD; checkout aceita `couponCode` → `promo-approved` (pula Stripe); conta com `billingSource=promo` + `promoExpiresAt`; expiração lazy + job 15 min → `status=paused` + `needsPlanSelection` no front; `POST /api/billing/checkout|redeem-coupon` para renovar/mudar plano; botão “Alterar plano” na Conta.  
- **Consequências:** Promo não cria subscription Stripe; após o período o tenant deve pagar ou usar outro cupom. `paused` é distinto de `suspended` (admin). Mesmo cupom só 1× por conta.  
- **Alternativas descartadas:** Stripe Coupons/Trials (exigiria subscription desde o dia 1); trial genérico sem vínculo a plano.

---

## 2026-07-28 — Gate por plano (entitlements configuráveis no admin)

- **Contexto:** Planos Solo/Equipe/Rede definidos no pricing; features existiam no produto mas sem enforcement; admin só editava bullets de marketing.  
- **Decisão:** Catálogo tipado de keys no código (`feature-catalog.ts`); valores por plano em `Plan.entitlements` (JSON); `Account.planId` FK; `EntitlementsService.assertFeature` / `assertLimit` (403 `PLAN_FEATURE_REQUIRED` / `PLAN_LIMIT_REACHED`); admin edita matriz; `/auth/me` e login expõem `entitlements`; front esconde tabs/settings. Seed/fallback: Solo R$139 / Equipe R$199 / Rede R$259.  
- **Stubs documentados:** `maxWhatsappNumbers` (produto ainda 1 número; connect efetivo `min(limit,1)`); `clientReschedule` (débito técnico — fluxo de remarcar no bot ainda não existe); `supportPriority` só UI (badge).  
- **Consequências:** Admin muda limites/features sem deploy de lógica; novas keys exigem hook no código. Contas sem `planId` resolvem por nome/alias (Essencial→Solo, Estúdio→Equipe) ou defaults Solo.  
- **Alternativas descartadas:** Feature flags globais sem plano; entitlements só no front; multi-WhatsApp e remarcação nesta entrega.

---

## 2026-07-23 — Bot: nome+sobrenome no 1º contato e matching de profissionais

- **Contexto:** 1º contato aceitava só um nome; texto digitado (ex. “João”, sem acento, título truncado) não batia com o profissional.  
- **Decisão:** `awaiting_name` exige ≥2 palavras; `resolveChoice` normaliza acentos, casa primeiro nome/parcial e títulos truncados; botões de prof usam 1º nome quando único.  
- **Consequências:** Clientes novos com nome completo; menos “não entendi” na escolha de profissional. Ambíguo (dois “João”) pede de novo.  
- **Alternativas descartadas:** Sempre mostrar nome completo truncado com reticências; forçar só número do menu.

---

## 2026-07-23 — `TZ=America/Sao_Paulo` no dyno da API Heroku

- **Contexto:** Bot usava `new Date()` local do servidor; dyno em UTC fazia “amanhã” virar o dia seguinte após 21h BRT (ex.: pediu 24/07 e marcou 25/07).  
- **Decisão:** Config var `TZ=America/Sao_Paulo` em `sof-solutions-api` para o Node interpretar data/hora local no fuso BR.  
- **Consequências:** Hoje/amanhã no bot alinhados ao Brasil sem redeploy de código. Contas com fuso diferente de SP ainda podem divergir até o bot usar `Account.timezone` de ponta a ponta.  
- **Alternativas descartadas:** Só corrigir código agora (melhor a médio prazo; pode coexistir com `TZ`).

---

## 2026-07-23 — Aviso WhatsApp ao profissional no novo agendamento

- **Contexto:** Profissional só via SSE no painel; cliente/painel marcavam horário no nome dele sem WhatsApp.  
- **Decisão:** `EmployeeBookingNotifyService` envia mensagem da instância da conta para `Employee.phone` após create `kind=service` (bot cliente + API conta). Skip se o próprio prof criou (portal/bot). Best-effort (não falha o create).  
- **Consequências:** Exige WhatsApp conectado na conta + telefone válido no profissional; recorrência vira uma mensagem com lista de horários.  
- **Alternativas descartadas:** Template HSM Meta; toggle por conta; notificar também em `kind=block`.

---

## 2026-07-23 — Apagar plano no admin limpa Stripe via API

- **Contexto:** Product/Payment Link criados por API só se removem por API; o admin não tinha exclusão e deixava órfãos na Stripe.  
- **Decisão:** `DELETE /api/plans/:id` desativa Payment Links (`active: false` — Stripe não tem DELETE), arquiva Prices, tenta `products.del` e se a Stripe recusar (ex.: Price associado) arquiva o Product. Só então apaga o `Plan` local. Erro da Stripe → `502` com a mensagem no front; plano permanece.  
- **Consequências:** Botão **Apagar plano** em `/edit-plan`; sem `STRIPE_SECRET_KEY` não apaga planos que tenham IDs/URL Stripe.  
- **Alternativas descartadas:** Soft-delete só no Sof; apagar DB sem tocar Stripe; exigir `stripePaymentLinkId` no schema antes de limpar.

---

## 2026-07-23 — Admin cria Payment Link junto com Product/Price

- **Contexto:** Ao criar plano no painel admin com Stripe, só Product + Price eram sincronizados; `paymentLinkUrl` ficava vazio e o link tinha que ser colado à mão.  
- **Decisão:** `StripeCatalogService.createProductAndPrice` também cria `paymentLinks.create` e grava a URL no plano. Ao trocar preço/intervalo (novo Price), gera um Payment Link novo e atualiza `paymentLinkUrl` (salvo override manual no mesmo request).  
- **Consequências:** Novo plano já nasce com link `buy.stripe.com`; edição de preço renova o link. Links antigos na Stripe não são desativados (não há `paymentLinkId` no schema).  
- **Alternativas descartadas:** Só Checkout Session no app sem Payment Links; botão separado “gerar link” no admin.

---

## 2026-07-23 — Menu do bot do profissional: concluir condicional + criar unificado

- **Contexto:** “Concluir” no menu poluía quando o prof não estava em atendimento; agendamento e evento eram duas entradas redundantes.  
- **Decisão:** **Concluir agendamento** só aparece (e em 1º) se houver horário `scheduled` na janela atual. **Novo na agenda** pergunta se é agendamento de cliente ou evento (almoço/médico). NLU/atalhos de `book`/`event` seguem diretos.  
- **Consequências:** Menu mais curto no dia a dia; conclusão antecipada continua liberando o slot.  
- **Alternativas descartadas:** Manter dois botões fixos; concluir sempre visível com erro se fora da janela.

---

## 2026-07-23 — Handoff humano também para profissionais

- **Contexto:** Profissionais no bot WhatsApp precisavam pedir ajuda da conta; a aba Atendimentos só cobria clientes e o webhook ignorava telefone de `Employee`.  
- **Decisão:** `WhatsappHandoff.party` (`client` | `employee`) + `employeeId`; `Employee.botUnresolvedCount`. Bot do prof: menu **Falar com estabelecimento**, regex/NLU `human`, e `unresolved` no fallback do menu. `afterBotResult` escala ambos. UI: badge Cliente (azul) vs Profissional (lilás). Resposta `fromMe` em prof resolve sem pausar o bot operacional.  
- **Consequências:** Mesmo threshold da conta; não cria `Client` fantasma para o telefone do prof.  
- **Alternativas descartadas:** Canal separado só para prof; silenciar bot do prof após handoff como no cliente.

---

## 2026-07-23 — Status `scheduled` / `completed` e liberação antecipada de slot

- **Contexto:** Precisávamos distinguir horário ainda ativo de atendimento já feito, auto-fechar quando a janela acaba, e permitir que o profissional liberasse o restante do slot se terminasse antes.  
- **Decisão:** Renomear `confirmed` → `scheduled`; adicionar `completed` + `completedAt`. Só `scheduled` entra em `listBusySlots`. Job a cada 5 min (`AppointmentCompletionsService`) marca `completed` quando `now >= endAt` (fuso da conta). Conta conclui via `POST /api/appointments/:id/complete` sem restrição de janela; profissional (web/bot) só dentro de [início, fim]. Bot: menu **Concluir horário** + intent NLU `complete`.  
- **Consequências:** Conclusão antecipada libera o horário restante para novos agendamentos; concluídos continuam visíveis na agenda com badge. Lembretes e conflitos ignoram `completed`/`cancelled`.  
- **Alternativas descartadas:** Manter `confirmed` só como label; encurtar `durationMinutes` em vez de mudar status; permitir conclusão do prof fora da janela.

---

## 2026-07-23 — Reset de senha do profissional (web + bot)

- **Contexto:** Reset só existia pelo painel da conta; o profissional ficava dependente do responsável.  
- **Decisão:** `EmployeePasswordResetService` (issue + CTA WhatsApp) compartilhado entre painel, `POST /api/employee-auth/request-password-reset` (público, resposta genérica) e opção **Redefinir senha** no menu/NLU do bot. UI: `/forgot-password` + link em `/login`.  
- **Consequências:** Sempre invalida a senha atual ao emitir o link; exige telefone do prof + WhatsApp da conta conectado.  
- **Alternativas descartadas:** E-mail SMTP; reset só por token na web sem WhatsApp; exigir senha atual no forgot.

---

## 2026-07-23 — Bot WhatsApp para profissionais (telefone cadastrado)

- **Contexto:** Profissionais precisavam operar agenda pelo mesmo WhatsApp do salão, sem cair no fluxo de cliente.  
- **Decisão:** Se o remetente casa com `Employee.phone` da conta, `WhatsappBotService` delega a `WhatsappEmployeeBotService` (steps `emp:*`): ver agenda (hoje/outro dia), marcar serviço, criar evento/`block`, cancelar. Áudio segue a mesma transcrição do webhook; NLU próprio no menu inicial (`agenda|book|event|cancel`). Profissionais **não** são silenciados por pausa da conta nem por pausa de cliente.  
- **Consequências:** Telefone do profissional precisa estar cadastrado (com ou sem DDI 55). Simulador testa com o mesmo número.  
- **Alternativas descartadas:** Código/PIN especial; fluxo único com flag; silenciar prof junto com a pausa global.

---

## 2026-07-23 — Pausa global do bot na Conta (WhatsApp)

- **Contexto:** Dono precisava silenciar o bot por algumas horas/dias sem pausar cliente a cliente.  
- **Decisão:** `Account.botPausedPermanent` + `botPausedUntil`; UI na seção Bot do WhatsApp (presets 1h/8h/24h/3d/7d/permanente). Webhook/simulador checam pausa da conta antes da pausa por cliente; **exceção:** telefone de `Employee` continua no bot operacional.  
- **Consequências:** `PUT /api/account` aceita os campos; migration `20260723140000_account_bot_pause`.  
- **Alternativas descartadas:** Só pausa por cliente; flag booleana sem timer.

---

## 2026-07-22 — Envio do link de senha do profissional via WhatsApp

- **Contexto:** Conta gerava link para copiar; faltava disparar pelo bot com instruções e CTA.  
- **Decisão:** `POST /api/employees/:id/send-password-link` emite token, zera senha e chama `WhatsappApiService.sendCtaUrl` (Meta `interactive/cta_url`; Uazapi tenta CTA em `/send/menu` e faz fallback para texto com o link). UI: botão no card do link e “Enviar link WhatsApp” no card do profissional.  
- **Consequências:** Requer telefone do profissional + WhatsApp da conta conectado.  
- **Alternativas descartadas:** Só texto sem CTA; e-mail (fora do escopo).

---

## 2026-07-22 — Tickets de suporte (conta + admin + profissional)

- **Contexto:** Estabelecimento precisa falar com a Sof; admin precisa ver abertos e responder; profissional também participa.  
- **Decisão:** Modelos `SupportTicket` + `SupportTicketComment` (status string `open|in_progress|resolved|closed`). Conta abre ticket; conta, profissional e admin comentam e mudam status. API produto com `TenantAuthGuard` (cookie/Bearer de conta **ou** profissional); admin em `admin-backend` `/api/tickets`. UI: aba Suporte no dashboard, portal profissional, Tickets no admin.  
- **Consequências:** Migration `20260722220000_support_tickets`; comentário do admin em ticket `open` promove para `in_progress`.  
- **Alternativas descartadas:** Só e-mail externo; chat em tempo real (SSE) nesta versão.

---

## 2026-07-22 — Rotas planas no admin-frontend (sem `[id]` irmão de lista)

- **Contexto:** No Expo Router web, rotas dinâmicas sob o mesmo shell (`accounts/index` + `accounts/[id]`) faziam a URL virar `/…/undefined` e a UI ficava em branco após login. `FlatList`+`gap` no RN Web também crashava.  
- **Decisão:** Rotas planas: `/accounts`, `/new-account`, `/edit-account`, `/plans`, `/new-plan`, `/edit-plan` (id via search params). Listas com `ScrollView`. Nav do shell sem `Link asChild`.  
- **Consequências:** URLs de detalhe mudam; docs atualizados.  
- **Alternativas descartadas:** Manter pastas `[id]` com workarounds de href.

---

## 2026-07-22 — Link de uso único para senha do profissional (2h)

- **Contexto:** Reset gerava senha temporária para a conta copiar; o profissional ainda precisava da “senha antiga” no 1º acesso.  
- **Decisão:** `EmployeePasswordToken` + endpoints públicos `GET/POST /api/employee-auth/password-setup`. Criar profissional ou `resetPassword` emite link `${PUBLIC_URL}/employee/set-password?token=…` (uso único, 2h). A página mostra o e-mail de login; ao definir senha, marca o token usado, limpa `mustChangePassword` e devolve JWT (login automático). Reset invalida senha anterior (`passwordHash=null`).  
- **Consequências:** Conta só compartilha URL; seed demo continua com senha conhecida. `trocar-senha` autenticado permanece para troca voluntária / legado.  
- **Alternativas descartadas:** Manter senha temporária + troca forçada; magic link sem senha (fora do escopo).

---

## 2026-07-22 — Telefone no cadastro de conta e profissional

- **Contexto:** Conta e profissionais não tinham telefone próprio (só WhatsApp da instância e telefone de clientes).  
- **Decisão:** Campos `Account.phone`, `Employee.phone` e `CheckoutSession.phone` (dígitos, DDD; validação 10–15). Obrigatório no checkout, CRUD de profissionais, criação/edição no admin e editável em Conta.  
- **Consequências:** Contas/profissionais antigos ficam com `phone=""` até atualizar; formulários e APIs passam a exigir telefone em novos cadastros.  
- **Alternativas descartadas:** Reutilizar `whatsappPhoneNumberId` (é ID de instância, não telefone humano).

---

## 2026-07-22 — Painel admin separado (mesmo Postgres) + catálogo `Plan`

- **Contexto:** Operadores Sof precisavam listar/editar contas e criar/alterar planos na Stripe sem misturar isso no dashboard do tenant.  
- **Decisão:** Apps novos `admin-backend/` (Nest, porta 3011) e `admin-frontend/` (Expo web, 8091), **mesmo PostgreSQL**. Modelos `AdminUser` e `Plan` no schema do produto. Auth admin com JWT/`sof_admin_session` e `ADMIN_JWT_SECRET`. Criar/editar plano sincroniza Product/Price na Stripe (Prices imutáveis → novo Price + arquiva o anterior). Checkout do produto lê `Plan` via `PlansService` (`GET /api/plans` público); `FALLBACK_PLANS` só se a tabela estiver vazia.  
- **Consequências:** Migrations só em `backend/prisma/`; generator `adminClient` gera client em `admin-backend/node_modules/.prisma/client`. Seed cria admin (`SEED_ADMIN_*`) e upsert dos 3 planos. Deploy Heroku do admin ainda não provisionado.  
- **Alternativas descartadas:** Módulo admin dentro do `backend/` do produto (superfície de ataque maior); DB separado; só Dashboard Stripe (sem gestão de contas Sof).

---

## 2026-07-21 — Lembretes WhatsApp com job 30 min e timezone por conta

- **Contexto:** O bot prometia lembrete na confirmação, mas não havia envio. Precisávamos avisar o cliente antes do horário pela instância Uazapi da conta, 1× por agendamento, com antecedência configurável (padrão 2h).  
- **Decisão:** `Account.whatsappReminderMinutes` (0|60|120|180|360|1440; 0=off) + `Account.timezone` (IANA, default `America/Sao_Paulo`). Em `Appointment`: `reminderClaimedAt` / `reminderSentAt`. `RemindersModule` com `@nestjs/schedule` (`@Interval` 30 min + tick no bootstrap). Candidatos: `kind=service`, `confirmed`, telefone, ainda não enviados, conta ativa com instância conectada e lead > 0. `date`/`time` interpretados no fuso da conta; envia se `now ∈ [start−lead, start)`. Claim SQL atômico antes do `sendText`; em falha libera claim para retry; sucesso grava `reminderSentAt`. UI na Conta (chips de antecedência + dropdown de fuso). Copy do bot/marketing alinhada ao WhatsApp (não SMS).  
- **Consequências:** Precisão de até ~30 min após o horário estimado; multi-dyno coberto pelo claim; risco residual raro de duplicata se a Uazapi aceitar o envio e o processo cair antes de persistir `reminderSentAt` (sem idempotency key na API).  
- **Alternativas descartadas:** Worker Heroku separado (complexidade sem ganho no MVP); Redis/Bull (add-on extra); SMS (canal diferente do bot); fuso só no servidor UTC (quebra horários BR).

## 2026-07-21 — Escalonamento humano com pausa por resposta no WhatsApp

- **Contexto:** Quando o bot não resolve (cliente pede atendente ou o bot repete "não entendi"), o dono não ficava sabendo e o bot continuava atrapalhando a conversa se um humano assumisse.  
- **Decisão:** Novo modelo `WhatsappHandoff` (1 alerta aberto por telefone) + `Client.botUnresolvedCount` + `Account.whatsappHandoffThreshold` (1|2|3|5, default 2). Pedido explícito por humano (regex estrita + intent `human` do NLU) abre alerta imediato; N "não entendi" seguidos abrem por contagem — intents `cancel`/`list`/`book` continuam no bot. Alertas aparecem na aba **Atendimentos** (badge SSE na tabbar, link para WhatsApp Web/`wa.me`). Detecção de resposta humana: webhook Uazapi passa a receber `fromMe` (exclui só `wasSentByApi` + grupos); mensagem `fromMe` não-API pausa o bot 1 h (`botPausedUntil`), zera contador e resolve o alerta. `GET /account/whatsapp/status` ressincroniza a config do webhook (máx. 1x/h por instância) para cobrir instâncias pareadas antes da mudança.  
- **Consequências:** Todo envio manual do dono pelo WhatsApp silencia o bot por 1 h naquela conversa (comportamento desejado); mais eventos de webhook (`fromMe`) para processar; cliente recebe aviso "avisei a equipe" quando o alerta abre.  
- **Alternativas descartadas:** Detectar humano via app próprio (não existe inbox no painel); pausar bot permanente na resposta humana (dono teria que reativar manualmente); webhook separado para eventos `fromMe` (complexidade sem ganho).

## 2026-07-21 — NLU com LLM para frases livres no bot

- **Contexto:** Áudios transcritos chegavam como frases corridas ("quero marcar um corte amanhã ao meio-dia") e o fluxo guiado só entendia opções exatas de menu, respondendo "Não entendi".  
- **Decisão:** Novo `BookingNluService` (OpenAI `gpt-4o-mini`, JSON estrito, timeout 10s) extrai intenção (book/cancel/list), `serviceId`, data e hora. Chamado só em frases livres (≥ 3 palavras) nas etapas `start` e `awaiting_service`; o resultado reaproveita o fluxo existente (`proceedWithSlot`, `timeMenu`, `pathMenu`), mantendo validação de expediente e conflito. Falha do LLM ou frase vaga → fluxo guiado normal.  
- **Consequências:** Usa a mesma `OPENAI_API_KEY` da transcrição; custo por mensagem ínfimo; mais uma chamada externa no caminho de mensagens livres.  
- **Alternativas descartadas:** Matching heurístico de substring (frágil para variações); LLM em todas as etapas do fluxo (mais custo/latência sem ganho claro).

## 2026-07-21 — Transcrição de áudio no bot WhatsApp (Uazapi nativo)

- **Contexto:** Clientes mandam áudio no WhatsApp; o bot só processava texto e botões, ignorando `audio`/`ptt`.  
- **Decisão:** Com `WHATSAPP_PROVIDER=uazapi`, detectar áudio no webhook, chamar `POST /message/download` com `transcribe: true` e tratar `transcription` como mensagem de texto no fluxo existente. Chave `OPENAI_API_KEY` no servidor (Uazapi usa Whisper; pode persistir na instância). Sem chave ou falha → resposta pedindo texto/botões.  
- **Consequências:** Custo baixo por áudio curto (~US$ 0,006/min); Meta Cloud API continua sem áudio; dedupe por `messageId` antes de transcrever evita cobrança duplicada em retries do webhook.  
- **Alternativas descartadas:** Groq/Whisper direto no backend (mais barato, mais código); responder só “mande em texto”; transcrição só no simulador.

## 2026-07-20 — Agenda responsiva no celular

- **Contexto:** A grade profissional × 7 dias forçava scroll horizontal e células estreitas no mobile.  
- **Decisão:** Abaixo de 720px, agenda do painel e do profissional usam chips de dia + lista vertical do dia selecionado; desktop mantém a grade/colunas.  
- **Consequências:** Menos overview da semana inteira de uma vez no celular; troca de dia é explícita.  
- **Alternativas descartadas:** Só zoom/scroll na grade; agenda diária sem chips da semana.

## 2026-07-20 — Menu WA: ver/cancelar se há agendamento futuro

- **Contexto:** Cliente que já tinha horário marcado só via serviços de novo; não havia caminho no bot para consultar ou cancelar.  
- **Decisão:** No cumprimento, se existirem agendamentos `confirmed` futuros do cliente, o menu inclui os serviços + **Ver agendamentos** + **Cancelar horário**. Sem futuro, só serviços. Cancelamento com confirmação Sim/Não e soft-cancel (`status=cancelled`) + SSE.  
- **Consequências:** Steps `awaiting_cancel_pick` / `awaiting_cancel_confirm`; comando global `cancelar` continua reiniciando a conversa (não cancela horário).  
- **Alternativas descartadas:** Menu separado Agendar/Gerenciar antes dos serviços; cancelar sem confirmação.

## 2026-07-20 — Fluxo WA: dia e horário em duas perguntas

- **Contexto:** Listar slots misturados de vários dias (ex. “Hoje 15:00”, “Amanhã 10:00”) deixava a escolha densa e pouco clara.  
- **Decisão:** Escolha em duas etapas: (1) **Hoje / Amanhã / Outra data** — Hoje e Amanhã só aparecem se houver ao menos 1 vaga; Outra data pede `dd/mm`; (2) até **5 horários** livres daquele dia + **Outro horário** (`hh:mm`). Steps `awaiting_day`, `awaiting_custom_date`, `awaiting_time`, `awaiting_custom_time`. Sessões antigas `awaiting_slot` / `awaiting_custom_datetime` redirecionam para o menu de dia.  
- **Consequências:** Fluxo mais longo em mensagens, mas menus menores e mais previsíveis; aceita atalho `dd/mm hh:mm` em vários steps.  
- **Alternativas descartadas:** Manter lista única de slots multi-dia; calendário com muitos dias sugeridos.

## 2026-07-20 — Fluxo WA: profissional ou horário após o serviço

- **Contexto:** Só horário → profissional escondia a preferência por um profissional; só profissional → horário não deixava o cliente priorizar disponibilidade.  
- **Decisão:** Após o serviço, menu com profissionais do serviço e, por último, **Escolher horário**. Caminho profissional → slots só desse profissional → confirmação. Caminho horário → slots de qualquer um → profissionais livres naquele horário + **Deixa a Sof escolher** (`emp:auto`, pega o primeiro livre) → confirmação. Se só 1 profissional livre no slot, confirma direto.  
- **Consequências:** Novo step `awaiting_path`; `awaiting_slot` / custom preservam `employeeId` quando já escolhido; menu de profissionais no caminho horário-primeiro inclui Sof.  
- **Alternativas descartadas:** Manter só horário → profissional; forçar sempre profissional antes do horário sem atalho.

## 2026-07-17 — Endereço da conta no painel e no bot

- **Contexto:** Cliente pergunta onde fica o salão; a conta precisava cadastrar endereço depois do signup.  
- **Decisão:** Campo `Account.address` (string opcional); edição na aba Conta; bot responde a “endereço/onde fica/como chegar”, inclui no cumprimento e na confirmação do agendamento.  
- **Consequências:** Contas sem endereço recebem mensagem pedindo para tentar depois; seed demo preenche um endereço de exemplo.  
- **Alternativas descartadas:** Endereço só no checkout; pin de mapa obrigatório.

## 2026-07-17 — Pausar bot WhatsApp por cliente

- **Contexto:** Dono precisa falar manualmente com um cliente sem o bot interferir, às vezes só por algumas horas.  
- **Decisão:** Campos `Client.botPausedPermanent` e `botPausedUntil`; UI na edição do cliente com presets (1h/8h/24h/7d) ou permanente; webhook/simulate silenciam se pausado (`isClientBotPaused`).  
- **Consequências:** Mute só para telefone já cadastrado como `Client`; sem auto-reply de “bot desativado”.  
- **Alternativas descartadas:** Mute global da conta; mensagem automática ao cliente; mute só na sessão WhatsApp sem flag no Client.

## 2026-07-17 — Fluxo WA: serviço → horário → profissional

- **Contexto:** Escolher profissional antes do horário forçava o cliente a decidir sem ver disponibilidade real.  
- **Decisão:** Novo fluxo: serviço → slots próximos (qualquer profissional do serviço livre) ou horário customizado → lista só profissionais disponíveis naquele slot → confirmação. Se só 1 profissional livre, pula direto para confirmar.  
- **Consequências:** Steps `awaiting_slot` / `awaiting_custom_datetime`; sessões antigas em `awaiting_datetime`/`awaiting_employee` sem data são redirecionadas.  
- **Alternativas descartadas:** Manter profissional primeiro; calendário de dias separados sem slots.

## 2026-07-17 — Botões/listas no bot WhatsApp

- **Contexto:** Escolhas eram só lista numerada em texto; no celular é mais natural tocar em botões.  
- **Decisão:** Enviar menus interativos (Uazapi `/send/menu`, Meta `interactive`): botões se ≤3 opções, lista se >3; webhook aceita id do botão/lista; números e título continuam como fallback (simulador).  
- **Consequências:** Confirmação usa Sim/Não em botões; se o envio do menu falhar, cai para texto numerado.  
- **Alternativas descartadas:** Só texto; só botões (quebraria com muitos serviços).

## 2026-07-17 — Eventos livres + recorrência materializada

- **Contexto:** A agenda só permitia atendimento com serviço/cliente; faltava bloquear horário com título livre (almoço, médico) e repetir agendamentos.  
- **Decisão:** `Appointment.kind` (`service` | `block`); em `block`, `serviceId`/cliente opcionais, `title` + `durationMinutes` obrigatórios, sem validação de expediente; recorrência diária/semanal/mensal materializa até 52 linhas com `recurrenceGroupId`; editar = 1 ocorrência; delete com `?scope=series` remove a série.  
- **Consequências:** Conflito de agenda usa `durationMinutes ?? service.duration`; faturamento ignora `block`; SSE emite um evento por ocorrência criada.  
- **Alternativas descartadas:** Modelo separado de “Block”; RRULE expandido só na leitura (mais complexo para conflito/UI).

## 2026-07-17 — Senha no checkout + agenda após pagamento

- **Contexto:** Conta era criada com senha temporária gerada; o retorno do Stripe mostrava credenciais e mandava para o login.  
- **Decisão:** Campo senha no modal de assinatura (hash na `CheckoutSession`); provisionamento usa essa senha; `GET /checkout/status` devolve JWT na 1ª leitura e o front entra direto em `/(dashboard)/agenda`.  
- **Consequências:** Coluna `tempPassword` renomeada para `passwordHash`; sem exibir senha na UI de retorno.  
- **Alternativas descartadas:** Manter senha gerada + tela de credenciais; login automático via e-mail/senha em plaintext na sessão.

## 2026-07-16 — Deduplicação de webhook Uazapi

- **Contexto:** Uazapi POSTava o mesmo evento em pares (~1 ms); bot respondia duas vezes. Possível empilhamento de webhooks sem `action: replace`.  
- **Decisão:** Ignorar eventos repetidos por `message.id` (fallback fingerprint); configurar webhook com `action: 'replace'`.  
- **Consequências:** Em multi-dyno a dedupe em memória não é compartilhada — ok com 1 dyno Heroku.  
- **Alternativas descartadas:** Persistência Redis só para dedupe.

## 2026-07-16 — Limpeza de envs não usadas (Uazapi + Stripe)

- **Contexto:** `.env` e Heroku acumulavam vars Meta (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`) e `STRIPE_PUBLISHABLE_KEY` que o runtime não lê (Checkout usa só secret + webhook).  
- **Decisão:** Remover essas três do `.env` local e da Heroku; `SEED_DEMO_*` ficam só para seed; Meta vars documentadas como opcionais no `.env.example`.  
- **Consequências:** Menos superfície de config; UI Conta não menciona publishable key.  
- **Alternativas descartadas:** Manter publishable “por se um dia usar Elements”.

## 2026-07-16 — Provider WhatsApp padrão = Uazapi

- **Contexto:** Meta Cloud API exigia Phone Number ID + app secret; o produto já opera com Uazapi (QR/código na Conta).  
- **Decisão:** Default de `WHATSAPP_PROVIDER` passou a `uazapi`; Meta permanece opcional via env. Pareamento na Conta aceita admin token (multi-tenant) ou `WHATSAPP_TOKEN` de instância única (legado), com fallback se o admin for inválido.  
- **Consequências:** `.env.example` e docs locais enfatizam Uazapi; `WHATSAPP_ADMIN_TOKEN` ≠ token da instância.  
- **Alternativas descartadas:** Manter default `meta`; exigir sempre admin token mesmo em dev com uma instância.

## 2026-07-16 — Pareamento WhatsApp por conta (QR/código Whazap)

- **Contexto:** O painel só gravava Instance ID manualmente; o QR ficava no Whazap e um único `WHATSAPP_TOKEN` no servidor não escalava multi-tenant.  
- **Decisão:** Com `WHATSAPP_ADMIN_TOKEN` + `WHATSAPP_BASE_URL`, cada `Account` cria/reusa uma instância Uazapi; Conta exibe QR ou código de pareamento; persistir `whatsappInstanceToken` (strip em `publicAccount`) + `whatsappPhoneNumberId`; envio/webhook usam o token da conta.  
- **Consequências:** Novos endpoints `/api/account/whatsapp/connect|status|disconnect`; `API_PUBLIC_URL` obrigatória em prod para registrar webhook; simulador na Agenda permanece.  
- **Alternativas descartadas:** Continuar colando Instance ID; um token global para todas as contas; Evolution API.

## 2026-07-15 — Planos Sof como assinaturas Stripe (sandbox)

- **Contexto:** Precisávamos de produtos recorrentes mensais e links de pagamento no sandbox.  
- **Decisão:** Criar Product + Price (`recurring.interval=month`) + Payment Link para Essencial (R$ 99), Estúdio (R$ 197) e Rede (R$ 249); Checkout da API passou a `mode: subscription` com `stripePriceId`.  
- **Consequências:** IDs e URLs em `backend/src/common/plans.ts`; Payment Links usáveis fora do app; webhook continua em `checkout.session.completed`.  
- **Alternativas descartadas:** Manter pagamento único (`mode: payment`); só Payment Links sem Checkout Session no app.

## 2026-07-16 — Gateway de pagamento: Stripe no lugar do Mercado Pago

- **Contexto:** Produto precisava trocar o gateway; Preference/MP era one-shot com redirect.  
- **Decisão:** Stripe Checkout Sessions (`mode: payment`) + webhook `checkout.session.completed`; envs `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY`; sem token → modo demo igual ao antigo; `preferenceId` no DB passa a guardar o id `cs_…` da sessão Stripe.  
- **Consequências:** Removido `mercadopago.service`; painel Conta e docs atualizados; webhook exige raw body + assinatura.  
- **Alternativas descartadas:** Payment Element embutido; Subscriptions Billing (próximo passo se quiser renovação automática de verdade).

## 2026-07-16 — Login unificado conta + profissional

- **Contexto:** Duas telas de login confundiam o fluxo.  
- **Decisão:** Um único `/login`; tenta `POST /api/auth/login` e, se o e-mail não existir na conta, tenta `POST /api/employee-auth/login`; redireciona ao painel ou à agenda do profissional. `/employee/login` vira redirect.  
- **Consequências:** Copy e gates apontam só para `/login`.  
- **Alternativas descartadas:** Toggle Empresa/Profissional; manter duas URLs.

## 2026-07-16 — Login do profissional (agenda própria)

- **Contexto:** Só o dono da conta tinha acesso; profissionais precisavam ver a própria agenda e cancelar horários.  
- **Decisão:** `Employee.email` (único), `passwordHash`, `mustChangePassword`; JWT com `role: employee` + cookie `sof_employee_session`; portal `/(employee)/*`; create gera senha temporária; 1º acesso força troca de senha; cancelamento do profissional marca `status=cancelled` (libera slot). Login unificado em `/login` (tenta conta, depois profissional se o e-mail não existir na conta).  
- **Consequências:** Cadastro de profissional exige e-mail; painel mostra senha gerada uma vez; endpoints `/api/employee-auth/*` e `/api/employee/appointments`.  
- **Alternativas descartadas:** Telas de login separadas; mesmo login da conta com role; hard delete no cancelamento do profissional; senha escolhida pelo dono sem geração automática.

## 2026-07-16 — Horário de funcionamento semanal da conta

- **Contexto:** Sugestões e agendamentos usavam janela fixa 09–18; o estabelecimento precisava escolher dias/horários.  
- **Decisão:** Campo `Account.openingHours` (JSON, 7 dias, índice 0=domingo); default seg–sáb 09:00–18:00 e domingo fechado; UI em Conta; create/update de appointments e bot WhatsApp só aceitam slots em que o serviço cabe inteiro no expediente; sugestões usam o open/close do dia.  
- **Consequências:** Migration `20260716010000_account_opening_hours`; `PUT /api/account` aceita `openingHours`; contas novas (seed/checkout) e existentes recebem o default.  
- **Alternativas descartadas:** Horário por profissional; múltiplos intervalos no mesmo dia; timezone por conta (fica no fuso do servidor/cliente parseando a data).

## 2026-07-15 — Bloquear horário ocupado do profissional

- **Contexto:** O simulador/WhatsApp e o create de appointments permitiam marcar o mesmo profissional no mesmo intervalo.  
- **Decisão:** Helper `schedule-conflict` com overlap por duração do serviço; API `POST/PUT /api/appointments` rejeita conflito; bot WA em `awaiting_datetime` e na confirmação sugere horários livres e mantém o passo até o cliente escolher outro.  
- **Consequências:** Só `status=confirmed` ocupa agenda; update exclui o próprio appointment do check; sugestões no dia usam o expediente da conta (antes era 09–18 fixo).  
- **Alternativas descartadas:** Só validar na API sem UX no bot; travar o dia inteiro sem sugestões; considerar `cancelled` como ocupado.

## 2026-07-15 — Scripts npm de deploy Heroku

- **Contexto:** Deploy de dois apps exigia lembrar remotes e dois `git push`.  
- **Decisão:** Scripts na raiz: `deploy:api`, `deploy:web`, `deploy` (api depois web), e `heroku:remotes`.  
- **Consequências:** Um comando `npm run deploy` publica back e front da HEAD atual para `main` nos remotes Heroku.  
- **Alternativas descartadas:** script shell separado; deploy paralelo (ordem api→web facilita falha da API antes do front).

## 2026-07-15 — Edição de serviços no painel

- **Contexto:** Só existia create/delete de serviços; preço/duração/nome precisavam ser alteráveis.  
- **Decisão:** `PUT /api/services/:id` com os mesmos campos do create; UI reutiliza o formulário em modo edição; ao salvar, sincroniza cópias do serviço embutidas em `employee.services` no estado do front.  
- **Consequências:** Cards ganham “Editar”; appointments existentes mantêm o `serviceId` e passam a refletir o preço novo só em novos agendamentos (create copia `service.price`).  
- **Alternativas descartadas:** Recriar serviço e migrar vínculos; editar preço retroativo em appointments antigos.

## 2026-07-15 — Remover telefone do profissional

- **Contexto:** Telefone do profissional não era usado no fluxo de agenda/WhatsApp.  
- **Decisão:** Dropar `Employee.phone` do schema, API e UI; cadastro fica nome + serviços.  
- **Consequências:** Migration `20260715234500_employee_drop_phone`.  
- **Alternativas descartadas:** Manter campo opcional oculto.

## 2026-07-15 — Edição de profissionais no painel

- **Contexto:** Só existia create/delete; era preciso alterar serviços de um profissional já cadastrado.  
- **Decisão:** `PUT /api/employees/:id` com os mesmos campos do create (`name`, `serviceIds` ≥ 1); replace dos vínculos `EmployeeService` em transaction; UI reutiliza o formulário em modo edição.  
- **Consequências:** Cards ganham ação “Editar”; lista na agenda/WhatsApp usa os serviços atualizados no próximo fetch.  
- **Alternativas descartadas:** PATCH parcial; edição só de nome sem mexer nos serviços.

## 2026-07-15 — Profissionais vinculados a serviços (N:N)

- **Contexto:** Especialidade como string livre não refletia o cardápio real nem filtrava quem podia realizar cada serviço.  
- **Decisão:** Remover `Employee.specialty`; criar `EmployeeService`; cadastro exige ≥ 1 `serviceId` da conta; WhatsApp e modal de agenda filtram profissionais pelo serviço; appointments validam o vínculo.  
- **Consequências:** Migration `20260715233000_employee_services` com backfill best-effort; API `POST /employees` recebe `serviceIds`; front usa multi-select de chips.  
- **Alternativas descartadas:** Manter specialty + serviços opcionais; só filtrar no painel sem mudar WhatsApp.

## 2026-07-15 — Documentação viva obrigatória para agentes

- **Contexto:** Novos agentes precisam entender o monorepo sem depender do histórico de chat.  
- **Decisão:** Criar `AGENTS.md` + pasta `docs/` com pacto de atualização contínua; regra Cursor `alwaysApply`.  
- **Consequências:** Features/arquitetura/deploy e ADRs devem ser editados na mesma sessão da mudança.  
- **Alternativas descartadas:** README único gigante sem índice; docs só no Notion.

## 2026-07-15 — Deploy em dois apps Heroku + Supabase

- **Contexto:** Separar front estático Expo e API Nest; banco já existia no Supabase.  
- **Decisão:** `sof-solutions-api` (`APP_BASE=backend`) e `sof-solutions-web` (`APP_BASE=frontend`); sem add-on Heroku Postgres; `DATABASE_URL` + `DIRECT_URL`.  
- **Consequências:** `EXPO_PUBLIC_API_URL` no build do web; CORS/PUBLIC_URL apontam para o web; deploy via `git push` para remotes `heroku-api` / `heroku-web`.  
- **Alternativas descartadas:** app único servindo static+API; Render-only (fica como opção em `render.yaml`).

## 2026-07-15 — Auth Bearer no web + cookie SameSite=None

- **Contexto:** Front e API em origens Heroku diferentes; cookie `SameSite=Lax` não autentica XHR cross-site.  
- **Decisão:** Front sempre envia `Authorization: Bearer`; cookie prod `secure` + `sameSite: 'none'`.  
- **Consequências:** `sof_token` no localStorage/SecureStore é caminho principal; SSE já usava Bearer.  
- **Alternativas descartadas:** proxy same-origin; subdomínios custom compartilhados (ainda não).

## 2026-07-15 — Prisma `DIRECT_URL` + encode de senha

- **Contexto:** Pooler Supabase (6543) + senha com `&` / `+` / `/` quebrava migrate e ferramentas JDBC.  
- **Decisão:** `directUrl` no schema; encode de senha nas config vars; DataGrip via campos separados + SSL na 5432.  
- **Consequências:** `.env.example` documenta `DIRECT_URL`; deploy precisa das duas URLs.  
- **Alternativas descartadas:** só `DATABASE_URL` no pooler para migrate.

## 2026-07-15 — Frontend Expo (RN + Web) com paridade visual

- **Contexto:** Frontend legado HTML; necessidade de iOS/Android + web.  
- **Decisão:** Migrar UI para Expo Router mantendo tokens/copy do HTML original; HTML legado só como referência visual.  
- **Consequências:** Um codebase; export estático para Heroku web; dependência `serve`.  
- **Alternativas descartadas:** manter site HTML separado do painel RN.

## 2026-07-15 — Separação NestJS + Prisma + Postgres

- **Contexto:** Backend acoplado / estático insuficiente para sessões, WhatsApp e MP.  
- **Decisão:** API Nest em `backend/`, Postgres (Docker local), Prisma migrations, módulos por domínio.  
- **Consequências:** Monorepo com scripts na raiz; seed demo; throttle e guards.  
- **Alternativas descartadas:** serverless only sem ORM; SQLite.

## 2026-07-15 — Renomear marca Soft → Sof

- **Contexto:** Produto se chama Sof.  
- **Decisão:** Branding, packages, cookie `sof_session`, token `sof_token`, Docker `sof`, componentes `Sof*`. Tokens CSS `accentSoft` / `shadow.soft` permanecem (adjetivo “suave”).  
- **Consequências:** Atualizar copy, README, Mercado Pago descriptor, WhatsApp greeting.  
- **Alternativas descartadas:** manter Soft só em infra.
