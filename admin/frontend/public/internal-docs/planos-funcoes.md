# Guias por plano — Sof

Funções de cada plano (alinha ao catálogo em `saas/backend/src/entitlements/feature-catalog.ts` e ao marketing em `saas/backend/src/common/plans.ts`). Valores no admin podem sobrescrever o padrão.

**HTML (enviar ao cliente):**

| Plano | Preço ref. | Arquivo |
|-------|------------|---------|
| Solo | R$ 139/mês | [`guides/plano-solo.html`](guides/plano-solo.html) |
| Equipe | R$ 199/mês | [`guides/plano-equipe.html`](guides/plano-equipe.html) |
| Rede | R$ 259/mês | [`guides/plano-rede.html`](guides/plano-rede.html) |

Publicado no admin: `/guides` + HTMLs em `public/guides/plano-*.html`.

---

## Solo

**Para quem:** até **3** profissionais; bot + agenda essenciais.

**Inclui:** bot com menus; agenda em tempo real; serviços/profissionais/clientes; agendamento e bloqueio no painel; portal do profissional; menu operacional WA (consulta); suporte por ticket; 1 WhatsApp.

**Não inclui:** lembretes, faturamento, recorrência, handoffs, pausar bot, profissional agenda/bloqueia no WA, escolha de caminho, “Deixa a Sof escolher”, NLU, pedido de humano, áudio, suporte prioritário.

---

## Equipe

**Para quem:** até **8** profissionais; operação com lembretes e atendimento humano.

**Além do Solo:** lembretes; faturamento; recorrência (até 52); handoffs; pausar bot; profissional marca/bloqueia no WA; booking path choice; Sof escolhe profissional; frase livre (NLU); cliente pede humano.

**Não inclui:** áudio (cliente/profissional), profissionais ilimitados, suporte prioritário.

---

## Rede

**Para quem:** profissionais **ilimitados**; áudio + prioridade.

**Além do Equipe:** áudio no agendamento; áudio/NLU no fluxo do profissional; suporte prioritário; sem teto de profissionais.

**Ainda 1 WhatsApp** (multi-número e remarcação dedicada = stub/backlog).

---

## Comparativo rápido

| Função | Solo | Equipe | Rede |
|--------|:----:|:------:|:----:|
| Bot + agenda + cadastros | ✓ | ✓ | ✓ |
| Lembretes / faturamento / recorrência | – | ✓ | ✓ |
| Handoffs, pausar bot, NLU | – | ✓ | ✓ |
| Áudio + suporte prioritário | – | – | ✓ |
| Profissionais | 3 | 8 | ∞ |
