# Mensagens do bot WhatsApp — Sof

Inventário vivo de **tudo** que a Sof envia no WhatsApp (cliente e profissional).  
Persona: [`brand.md`](brand.md). Copy canônica: [`saas/backend/src/whatsapp/bot-copy.ts`](../saas/backend/src/whatsapp/bot-copy.ts).

**Como manter atualizado:** ao mudar texto em `bot-copy.ts`, `whatsapp-bot.service.ts`, `whatsapp-employee-bot.service.ts`, `whatsapp.controller.ts`, lembretes, notify ou reset de senha, atualize **esta página na mesma sessão**.

Variáveis: `${…}` = interpolação. Menus interativos do **cliente** também repetem as opções numeradas + *“Toque numa opção ou responda com o número.”*

Última revisão: **2026-07-30**.

---

## Cliente (agenda pelo WhatsApp)

### Saudação e cadastro

| Mensagem |
|----------|
| `Oi. Aqui é a Sof, do ${businessName}. Qual é o seu nome e sobrenome?` |
| `Me diga seu nome e sobrenome (ex.: Ana Silva).` |
| `Oi, ${clientName}. Aqui é a Sof, do ${businessName}.` |
| `${intro}` + `O que você precisa?` (menu inicial) |
| `${intro} Qual serviço você quer agendar?` |

### Endereço

| Mensagem |
|----------|
| `Endereço do ${businessName}:` + linha com o endereço |
| `Ainda não temos o endereço cadastrado do ${businessName}. Pode perguntar pelo WhatsApp do estabelecimento ou tentar de novo em breve.` |

### Fluxo de agendamento

| Mensagem |
|----------|
| `Certo: ${serviceName}. Quem você prefere?` |
| `Certo: ${serviceName}. Qual dia você prefere?` |
| `Certo: ${serviceName} em ${dayLabel}. Horários:` |
| `Com ${preferredName}. Qual dia você prefere?` |
| `Qual dia você prefere?` |
| `Horários em ${dayLabel}:` |
| `Qual data você prefere?` + `Envie assim: 25/12` + `Funcionamento: ${resumo}` |
| `Em ${dayLabel} não achei horários livres na lista.` + `Me diga um horário assim: 15:00` + `Funcionamento: ${start}–${end}` |
| `Me diga o horário assim: 15:00` + `Funcionamento: ${resumo}` |
| `Preciso da data primeiro. Qual dia?` |
| `Vamos escolher o dia de novo:` |
| `Quem você prefere em ${dayLabel} ${time}?` |
| `Vamos recomeçar — qual serviço você quer agendar?` |

### Confirmações

| Mensagem |
|----------|
| `Podemos agendar ${service} com ${employee} em ${dd/mm/yyyy} às ${time}?` |
| `${name} está livre nesse horário. Podemos agendar ${service} em ${dd/mm/yyyy} às ${time}?` |
| `Confirma o agendamento? Toque em Sim ou Não.` |
| `Agendado.${reminder?} Até lá.` |
| `Agendado.${reminder?}` + `Endereço: ${address}` + `Até lá.` |
| *(reminder)* ` Você recebe um lembrete no WhatsApp ${leadLabel} antes do horário.` |
| `Sem problemas, não agendei nada. Quando quiser agendar, é só chamar.` |
| `Certo, mantive o horário.` |

### Cancelar / listar

| Mensagem |
|----------|
| `Seus próximos agendamentos:` + linhas |
| `Você não tem agendamentos futuros.` |
| `Você não tem agendamentos futuros para cancelar.` |
| `Qual horário você quer cancelar?` |
| `Cancelar ${linhaDoAgendamento}?` |
| `Confirma o cancelamento? Toque em Sim ou Não.` |
| `Pronto, cancelei ${linhaDoAgendamento}.` |
| `Esse horário já não estava agendado.` |
| `Esse horário já passou; não dá para cancelar por aqui.` |

### Reset / cancelar fluxo

| Mensagem |
|----------|
| `Pronto, reiniciei a conversa. É só mandar uma mensagem quando quiser agendar.` |
| `Certo, cancelei o que estava em andamento. Quando quiser, é só chamar para agendar.` |

### Handoff humano

| Mensagem |
|----------|
| `Certo — vou chamar a equipe para continuar por aqui.` |
| `Avisei a equipe — alguém vai te responder por aqui em breve.` |
| `No momento não consigo transferir para um atendente por aqui. Use o menu para agendar ou cancelar.` |

### Áudio / setup

| Mensagem |
|----------|
| `Não consegui ouvir o áudio. Pode escrever ou escolher uma opção?` |
| `Por aqui, prefiro texto. Pode escrever ou escolher uma opção?` |
| `Esse estabelecimento ainda está configurando o agendamento por aqui. Peça para tentarem de novo em instantes ou contate o número do negócio.` |

### Erros e “não peguei”

| Mensagem |
|----------|
| `Não entendi.` |
| `Não entendi. Escolha um serviço:` |
| `Não entendi. Qual horário você quer cancelar?` |
| `Não entendi. Escolha um profissional ou Escolher horário:` |
| `Não entendi. Escolha Hoje, Amanhã ou Outra data:` |
| `Não entendi. Escolha um horário da lista ou toque em Outro horário:` |
| `Não entendi. Escolha um profissional:` |
| `Não entendi. Quem você prefere em ${slot}?` |
| `Por enquanto nenhum profissional faz ${service}. Escolha outro serviço:` |
| `Esse profissional não faz esse serviço. Escolha de novo:` |
| `Nesse dia (${dayLabel}) estamos fechados. Escolha outro:` |
| `Nesse dia estamos fechados. Escolha outro:` |
| `Horário fora do expediente (${start}–${end}). Escolha outro:` |
| `Nesse horário ninguém está livre. Escolha outro:` |
| `Nesse horário ninguém está mais livre. Escolha outro dia:` |
| `Esse profissional não está livre nesse horário. Quem você prefere?` |
| `Esse horário acabou de ser preenchido. Escolha outro:` |
| `Não consegui entender. Envie a data assim: 25/12` + `Ou digite /reset para recomeçar.` |
| `Não consegui entender. Envie o horário assim: 15:00` + `Ou digite /reset para recomeçar.` |

### Lembrete automático (job)

| Mensagem |
|----------|
| `Oi, ${name}. Lembrete da ${businessName}:` |
| `${serviço} com ${profissional} — ${dd/mm/yyyy} às ${time}.` |
| `Endereço: ${address}` *(se houver)* |
| `Até lá.` |

### Botões / labels do menu (cliente)

| Título | Descrição (lista) |
|--------|-------------------|
| `${serviço} ${preço}` | `${duração} min · ${preço}` |
| `Ver agendamentos` | `Seus horários agendados` |
| `Cancelar horário` | `Cancelar um agendamento` |
| `${1º nome ou nome}` | nome completo do profissional |
| `Escolher horário` | `Ver horários livres primeiro` |
| `Deixa a Sof escolher` | `Quem estiver livre` / `Quem estiver livre nesse horário` |
| `Hoje` | `Ver horários de hoje` |
| `Amanhã` | `Ver horários de amanhã` |
| `Outra data` | `Informar dia (dd/mm)` |
| `${hh:mm}` | `${dayLabel} às ${time}` |
| `Outro horário` | `Enviar hora (hh:mm)` |
| `Sim` | `Confirmar esta ação` |
| `Não` | `Voltar sem confirmar` |

List buttons: `Ver opções` · `Ver serviços` · `Ver profissionais` · `Ver dias` · `Ver horários` · `Confirmar`.  
Footer: `Ou digite hh:mm`.

---

## Profissional (menu operacional)

### Saudação e menu

| Mensagem |
|----------|
| `Oi, ${employeeName}. Aqui é a Sof — menu do profissional (${businessName}).` |
| `Pronto, ${employeeName}. Reiniciei o menu do profissional. Manda qualquer mensagem para ver as opções.` |
| `Não entendi. Escolha uma opção do menu:` |
| `Certo, ${employeeName} — vou avisar a conta para te atender por aqui.` |
| `Por aqui ainda não consigo fazer isso. Use o painel ou o portal.` |

### Agenda

| Mensagem |
|----------|
| `Qual dia da agenda?` |
| `Agenda de ${label}: livre. O que mais?` |
| `Agenda de ${label}:` + linhas `• …` + `O que mais?` |
| `Manda a data em dd/mm (ex.: 25/07).` |
| `Manda a data no formato dd/mm (ex.: 25/07) ou toque em Hoje / Amanhã.` |
| `Manda a data em dd/mm.` |
| `Data inválida. Use dd/mm (ex.: 28/07).` |
| `Escolha Hoje, Amanhã ou Outra data.` |

### Criar — tipo / serviço / evento

| Mensagem |
|----------|
| `O que você quer criar?` |
| `Qual serviço do cliente?` |
| `Escolha um serviço da lista.` |
| `Você ainda não tem serviços vinculados. Peça para a conta configurar na aba Profissionais.` |
| `Qual o título do evento? (ex.: Almoço, Médico)` |
| `Qual o título do evento? (ex.: Almoço, Médico, Reunião)` |
| `Quanto tempo dura?` |
| `Evento “${title}”. Quanto tempo dura?` |
| `Escolha 30 min, 1h, 1h30 ou 2h.` |
| `Qual dia?` |

### Cliente / horário

| Mensagem |
|----------|
| `Qual o nome do cliente?` |
| `Nome do cliente?` |
| `Telefone do(a) ${name}? (DDD + número, só dígitos — ou “pular” se não tiver)` |
| `Telefone inválido. Manda com DDD (ex.: 11999998888) ou “pular”.` |
| `Horários livres em ${dd/mm/yyyy}:` |
| `Sem horários livres em ${dd/mm/yyyy}. Escolha outro dia:` |
| `Fora do expediente ou dia fechado. Escolha outro dia:` |
| `Qual horário? (hh:mm)` |
| `Escolha um horário da lista ou digite hh:mm.` |
| `Horário inválido. Use hh:mm (ex.: 14:30).` |
| `Esse horário conflita com outro compromisso. Escolha outro:` |
| `Alguém pegou esse horário no meio do caminho. Tente de novo.` |
| `Serviço inválido.` |

### Confirmações (criar / cancelar / concluir)

| Mensagem |
|----------|
| `Confirma com Sim ou Não?` |
| `Podemos agendar ${service} para ${clientName}${telefone?} em ${when}?` |
| `Bloquear “${title}” (${durationMinutes} min) em ${dd/mm/yyyy} às ${time}?` |
| `Agendamento criado: ${service} em ${dd/mm/yyyy} às ${time}.` |
| `Evento “${title}” gravado em ${dd/mm/yyyy} às ${time}.` |
| `Certo, não gravei. O que você quer fazer?` |
| `Qual horário cancelar?` |
| `Cancelar ${linha}?` |
| `Confirma o cancelamento? Sim ou Não.` |
| `Horário cancelado. Mais alguma coisa?` |
| `Certo, mantive o horário.` |
| `Esse horário já não estava ativo.` |
| `Não achei esse horário. Escolha na lista.` |
| `Você não tem horários futuros para cancelar.` |
| `Não achei um horário com esses dados. Quer tentar de outro jeito?` |
| `Qual agendamento concluir? (só os que estão na janela agora)` |
| `Marcar como concluído: ${line}? O restante do horário fica livre na agenda.` |
| `Marcar como concluído: ${line}? O restante do horário fica livre.` |
| `Confirma a conclusão? Sim ou Não.` |
| `Marcado como concluído — o restante do horário ficou livre. Mais alguma coisa?` |
| `Certo, mantive como agendado.` |
| `Nenhum atendimento em andamento agora. Só dá para concluir dentro da janela do horário.` |
| `Não achei um atendimento em andamento com esses dados.` |

### Senha

| Mensagem |
|----------|
| `Olá, ${name}. Você pediu para redefinir a senha da agenda Sof (${business}).` + instruções |
| `Olá, ${name}.` + `${business} enviou um link…` + instruções |
| Instruções: toque em Redefinir senha → crie senha → Pronto; link uso único, 2 h |
| Botão CTA: `Redefinir senha` · Footer: `Sof · acesso do profissional` |
| `Pronto! Enviei o link para redefinir a senha neste WhatsApp. O link vale 2 horas. O que mais?` |
| `Não consegui enviar o link agora.` (+ detalhe / pedir ajuda à conta) |

### Aviso de novo agendamento (notify)

| Mensagem |
|----------|
| `Novo agendamento na Sof (${business}):` *ou* `Novos agendamentos na Sof (${business}):` |
| `Cliente: ${client}` |
| `Serviço: ${service}` |
| `Quando: ${dd/mm/yyyy às time}` *ou* lista `Horários:` + `• …` |
| `Origem: WhatsApp do cliente` *ou* `Origem: painel` |

### Áudio (mesmo fallback do cliente)

| Mensagem |
|----------|
| `Não consegui ouvir o áudio. Pode escrever ou escolher uma opção?` |
| `Por aqui, prefiro texto. Pode escrever ou escolher uma opção?` |

### Botões / labels do menu (profissional)

| Título | Descrição |
|--------|-----------|
| `Concluir agendamento` | `Encerrar o atendimento atual` |
| `Agenda de hoje` | `Ver seus horários de hoje` |
| `Agenda de outro dia` | `Escolher outra data` |
| `Novo na agenda` | `Agendamento ou evento` |
| `Cancelar horário` | `Desmarcar um horário futuro` |
| `Falar com estabelecimento` | `Pedir ajuda da conta do salão` |
| `Redefinir senha` | `Receber link no WhatsApp` |
| `Agendamento` | `Serviço para um cliente` |
| `Evento` | `Almoço, médico, reunião…` |
| `Hoje` / `Amanhã` / `Outra data` | datas |
| `30 min` / `1 hora` / `1h30` / `2 horas` | durações |
| `${hh:mm}` | `Horário livre neste dia` |
| `Outro horário` | `Informar a hora em hh:mm` |
| `Sim` / `Não` | confirmar / voltar |

List buttons típicos: `Opções` · `Dias` · `Tipo` · `Duração` · `Serviços` · `Agendamentos` · `Horários` · `Confirmar`.

---

## Fontes no código

| Superfície | Arquivo |
|------------|---------|
| Copy central | `saas/backend/src/whatsapp/bot-copy.ts` |
| Fluxo cliente | `saas/backend/src/whatsapp/whatsapp-bot.service.ts` |
| Fluxo profissional | `saas/backend/src/whatsapp/whatsapp-employee-bot.service.ts` |
| Fallbacks webhook | `saas/backend/src/whatsapp/whatsapp.controller.ts` |
| Lembrete | `saas/backend/src/reminders/` (+ `bot-copy.buildReminderMessage`) |
| Aviso ao prof | `saas/backend/src/whatsapp/employee-booking-notify.service.ts` |
| Reset senha | `saas/backend/src/employee-portal/employee-password-reset.service.ts` |

Não listados aqui (não são copy ao usuário): prompts NLU, logs, respostas só do simulador no painel (“Bot pausado…”).
