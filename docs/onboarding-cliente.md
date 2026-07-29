# Guia de onboarding — Sof

Material para o cliente: do **plano/cupom** até a Sof funcionar de ponta a ponta (WhatsApp + agenda).

**Versão HTML (recomendada para enviar ao cliente):** [`guides/onboarding-cliente.html`](guides/onboarding-cliente.html)  
**Bot WhatsApp (cliente + profissional):** [`guides/bot-whatsapp.html`](guides/bot-whatsapp.html)

**Publicado no admin (sem login):** `/guides` · `/guides/onboarding` · `/guides/bot`  
(ex. produção: `https://sof-agendamento-admin-web-234d632f6b1f.herokuapp.com/guides`)

Site: [www.sof.solutions](https://www.sof.solutions) · Planos: [www.sof.solutions/pricing](https://www.sof.solutions/pricing)

---

## O que precisa ficar pronto

| Ordem | O quê | Por quê |
|------:|-------|---------|
| 1 | Conta criada (plano pago **ou** cupom) | Acesso ao painel |
| 2 | Contato + endereço + horário | Bot responde “onde fica” e só agenda no expediente |
| 3 | WhatsApp conectado (QR ou código) | Clientes marcam de verdade no WhatsApp |
| 4 | Pelo menos **1 serviço** | Cardápio do bot e da agenda |
| 5 | Pelo menos **1 profissional** ligado a serviço(s) | Agenda e fluxo WhatsApp |
| 6 | (Opcional) Clientes | Podem nascer sozinhos no 1º contato no WhatsApp |

Sem profissionais, a agenda fica vazia. Sem WhatsApp conectado, use só o simulador (demo).

---

## Passo 1 — Escolher o plano

1. Abra **Planos** no site (`/pricing`).
2. Compare **Solo**, **Equipe** e **Rede**.
3. Clique em **Assinar …** no plano desejado.

![Tela de planos Solo, Equipe e Rede](assets/onboarding/01-planos.png)

---

## Passo 2 — Cadastro e pagamento (ou cupom)

O modal **Finalizar assinatura** pede:

- Nome completo  
- Telefone (com DDD)  
- E-mail (login do painel)  
- Senha (mín. 8 caracteres)  
- Cupom promocional (opcional)

### Sem cupom → Stripe

Preencha os dados e clique em **Continuar para o pagamento**. Você vai ao Stripe; depois entra direto na agenda.

![Checkout sem cupom — Continuar para o pagamento](assets/onboarding/02-checkout.png)

### Com cupom → conta na hora

Digite o código no campo **Cupom promocional**. O total vira **R$ 0,00**, o botão muda para **Ativar com cupom** e a conta é criada **sem Stripe** (o plano do cupom prevalece).

![Checkout com cupom — Ativar com cupom](assets/onboarding/02b-checkout-cupom.png)

> Cupom = plano + período grátis (ex.: 7/30/60 dias). Ao vencer, a conta pede plano de novo (Stripe ou outro cupom).

---

## Passo 3 — Entrar no painel

Se já tiver conta: **Entrar** (`/login`) com e-mail e senha.

![Tela Entrar](assets/onboarding/03-login.png)

Depois do checkout, o login costuma ser automático e você cai na **Agenda**.

![Agenda logo após o cadastro (ainda sem profissionais)](assets/onboarding/04-agenda.png)

Se a mensagem for *“Nenhum profissional cadastrado”*, siga os passos 4–6 abaixo.

---

## Passo 4 — Conta: identidade, contato e horário

Aba **Conta**. Em telas largas, os cards ficam em **duas colunas**.

### Estabelecimento e assinatura

- Confira o plano em **Assinatura** (ou **Alterar plano**).  
- No card **Estabelecimento**, toque no ícone de **editar** → modal com logo, telefone e endereço (o bot usa isso na conversa) → **Salvar**.

![Conta — grade com estabelecimento, horário, plano e WhatsApp](assets/onboarding/07-conta.png)

### Horário de funcionamento

No card **Horário**, ícone de **editar** → marque dias abertos/fechados e horários → **Salvar**.  
O bot só oferece horários dentro desse expediente.

![Modal Horário de funcionamento](assets/onboarding/07c-horarios.png)

---

## Passo 5 — Conectar o WhatsApp

Na mesma aba **Conta**, card **WhatsApp** (ao lado do plano no desktop):

1. Confirme **Servidor = Pronto**.  
2. O **QR já aparece aberto** — escaneie no WhatsApp (Aparelhos conectados). O código **renova sozinho**.  
3. Ou use **Usar código** com o número do aparelho.  
4. Aguarde **Dispositivo = Conectado**.

![Pareamento WhatsApp — QR aberto automaticamente](assets/onboarding/07b-conta-whatsapp.png)

Com WhatsApp conectado (e no plano certo), aparecem também **lembretes** e **pausa do bot**.

---

## Passo 6 — Serviços (cardápio)

Aba **Serviços** → **Adicionar serviço** (abre um **modal**).

Informe **nome**, **duração (min)** e **preço (R$)** → **Salvar**. Esse cardápio aparece no WhatsApp e na agenda.

![Lista de serviços](assets/onboarding/05-servicos.png)

![Formulário Novo serviço](assets/onboarding/05b-novo-servico.png)

---

## Passo 7 — Profissionais

Aba **Profissionais** → **Adicionar profissional** (abre um **modal**).

- Nome, telefone, e-mail de acesso  
- Cor na agenda  
- **Serviços que realiza** (obrigatório ≥ 1)  

Ao salvar, a Sof gera um **link de uso único (2h)** para o profissional definir a senha. Depois você pode enviar de novo por **Senha no WhatsApp**.

![Modal Novo profissional](assets/onboarding/06-novo-profissional.png)

![Lista de profissionais](assets/onboarding/06b-profissionais-lista.png)

> Sem serviço cadastrado, “Adicionar profissional” leva você primeiro para Serviços.

---

## Passo 8 — Clientes (opcional)

Aba **Clientes**. Pode cadastrar na mão **ou** deixar o WhatsApp criar no 1º contato (nome e sobrenome).

![Clientes — lista vazia / começo](assets/onboarding/08-clientes-vazio.png)

![Clientes cadastrados](assets/onboarding/08b-clientes-lista.png)

---

## Passo 9 — Conferir a agenda

Com serviços + profissionais, a **Agenda Semanal** mostra a grade. Clique numa célula para agendar ou num horário para editar.

![Agenda com equipe e horários](assets/onboarding/04b-agenda-pronta.png)

Teste rápido: na Agenda, bloco **Bot do WhatsApp — simulador** (útil antes ou sem número real). Em produção, a conversa real no número conectado cai na agenda na hora.

---

## Alterar plano ou usar outro cupom depois

**Conta → Alterar plano** (`/choose-plan`):

- Campo **Cupom promocional** → **Aplicar cupom**  
- Ou **Assinar** um plano (Stripe)

![Alterar plano / aplicar cupom](assets/onboarding/09-alterar-plano.png)

---

## Checklist “Sof pronta”

- [ ] Conta ativa (pago ou cupom)  
- [ ] Telefone e endereço salvos  
- [ ] Horário de funcionamento correto  
- [ ] WhatsApp **conectado**  
- [ ] ≥ 1 serviço  
- [ ] ≥ 1 profissional com serviço(s)  
- [ ] Profissional definiu senha (link / WhatsApp)  
- [ ] Teste: mensagem “oi” no WhatsApp da barbearia → bot responde e agenda  

---

## Onde pedir ajuda

**Conta → Abrir suporte** — ticket para a equipe Sof (conta, cobrança ou WhatsApp).

---

*Prints capturados do produto em produção (jul/2026). Atualize as imagens em `docs/assets/onboarding/` se a UI mudar de forma relevante.*
