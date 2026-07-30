/**
 * Copy canônica do bot WhatsApp — voz da Sof.
 * Fonte de verdade da persona: docs/brand.md
 *
 * Leve, confiante, calma, sofisticada. Sem emoji, sem exclamação em excesso.
 */

/** Prefixo curto de avanço de fluxo (substitui “Combinado:”). */
export const ACK = 'Certo';

/** Quando a Sof não compreende a mensagem. */
export const DID_NOT_CATCH = 'Não peguei isso.';

export function greetNewClient(businessName: string): string {
  return `Oi. Aqui é a Sof, do ${businessName}. Qual é o seu nome e sobrenome?`;
}

export function askFullNameAgain(): string {
  return 'Me diga seu nome e sobrenome (ex.: Ana Silva).';
}

export function greetKnownClient(
  clientName: string,
  businessName: string,
  address?: string | null,
): string {
  const addressBit = (address || '').trim()
    ? ` Nosso endereço: ${address!.trim()}.`
    : '';
  return `Oi, ${clientName}. Aqui é a Sof, do ${businessName}.${addressBit}`;
}

export function formatAddressReply(opts: {
  businessName: string;
  address?: string | null;
}): string {
  const address = (opts.address || '').trim();
  if (!address) {
    return `Ainda não temos o endereço cadastrado do ${opts.businessName}. Pode perguntar pelo WhatsApp do estabelecimento ou tentar de novo em breve.`;
  }
  return `Endereço do ${opts.businessName}:\n${address}`;
}

export function handoffToTeam(): string {
  return `${ACK} — vou chamar a equipe para continuar por aqui.`;
}

export function handoffNoticeAfterAlert(): string {
  return 'Avisei a equipe — alguém vai te responder por aqui em breve.';
}

export function handoffUnavailable(): string {
  return 'No momento não consigo transferir para um atendente por aqui. Use o menu para agendar ou cancelar.';
}

export function audioFailed(): string {
  return 'Não consegui ouvir o áudio. Pode escrever ou escolher uma opção?';
}

/** Áudio indisponível (gate de plano) — nunca mencionar plano ao interlocutor. */
export function audioNotInPlan(): string {
  return 'Por aqui, prefiro texto. Pode escrever ou escolher uma opção?';
}

/** Ação do profissional bloqueada por entitlement — sem citar plano. */
export function employeeActionUnavailableOnWhatsapp(): string {
  return 'Por aqui ainda não consigo fazer isso. Use o painel ou o portal.';
}

export function setupIncomplete(): string {
  return 'Esse estabelecimento ainda está configurando o agendamento por aqui. Peça para tentarem de novo em instantes ou contate o número do negócio.';
}

export function conversationReset(): string {
  return 'Pronto, reiniciei a conversa. É só mandar uma mensagem quando quiser agendar.';
}

export function conversationCancelled(): string {
  return 'Certo, cancelei o que estava em andamento. Quando quiser, é só chamar para marcar um horário.';
}

export function restartServicePrompt(): string {
  return 'Vamos recomeçar — qual serviço você quer agendar?';
}

export function didNotCatchWithHint(hint: string): string {
  return `${DID_NOT_CATCH} ${hint}`;
}

export function keptAppointment(): string {
  return `${ACK}, mantive o horário.`;
}

export function cancelledNothingBooked(): string {
  return 'Sem problemas, não marquei nada. Quando quiser agendar, é só chamar.';
}

export function ackServicePath(serviceName: string, nextQuestion: string): string {
  return `${ACK}: ${serviceName}. ${nextQuestion}`;
}

export function ackServiceDay(serviceName: string, dayLabel: string): string {
  return `${ACK}: ${serviceName} em ${dayLabel}. Horários:`;
}

export function bookedConfirmation(opts: {
  reminderLeadLabel?: string | null;
  address?: string | null;
}): string {
  const lead = (opts.reminderLeadLabel || '').trim();
  const reminderLine = lead
    ? ` Você recebe um lembrete no WhatsApp ${lead} antes do horário.`
    : '';
  const address = (opts.address || '').trim();
  if (address) {
    return `Marcado.${reminderLine}\nEndereço: ${address}\nAté lá.`;
  }
  return `Marcado.${reminderLine} Até lá.`;
}

export function menuTouchOrNumber(bodyText: string, numbered: string): string {
  return `${bodyText}\n${numbered}\n\nToque numa opção ou responda com o número.`;
}

/** Menu / saudação do profissional. */
export function greetEmployee(
  employeeName: string,
  businessName: string,
): string {
  return `Oi, ${employeeName}. Aqui é a Sof — menu do profissional (${businessName}).`;
}

export function employeeMenuReset(employeeName: string): string {
  return `Pronto, ${employeeName}. Reiniciei o menu do profissional. Manda qualquer mensagem para ver as opções.`;
}

export function employeeHandoff(employeeName: string): string {
  return `${ACK}, ${employeeName} — vou avisar a conta para te atender por aqui.`;
}

export function employeeDidNotCatchMenu(): string {
  return `${DID_NOT_CATCH} Escolha uma opção do menu:`;
}

export function employeeDiscardedDraft(): string {
  return 'Certo, não gravei. O que você quer fazer?';
}

export function employeeKeptAppointment(): string {
  return 'Certo, mantive o horário.';
}

export function employeeCompleted(): string {
  return 'Marcado como concluído — o restante do horário ficou livre. Mais alguma coisa?';
}

export function employeeKeptScheduled(): string {
  return 'Certo, mantive como agendado.';
}

export function passwordResetBody(opts: {
  employeeName: string;
  businessName: string;
  source: 'account' | 'self';
}): string {
  const business = opts.businessName || 'seu estabelecimento';
  const intro =
    opts.source === 'self'
      ? `Olá, ${opts.employeeName}. Você pediu para redefinir a senha da agenda Sof (${business}).`
      : `Olá, ${opts.employeeName}.\n\n${business} enviou um link para você definir (ou redefinir) a senha de acesso à agenda Sof.`;

  return [
    intro,
    '',
    'Instruções:',
    '1. Toque em "Redefinir senha"',
    '2. Crie uma senha nova',
    '3. Pronto — você já entra na sua agenda',
    '',
    'O link é de uso único e vale por 2 horas.',
  ].join('\n');
}

export function buildReminderMessage(opts: {
  clientName: string;
  businessName: string;
  serviceName: string;
  employeeName: string;
  date: string;
  time: string;
  address?: string;
}): string {
  const name = (opts.clientName || '').trim() || 'olá';
  const when = formatFriendlyWhen(opts.date, opts.time);
  const service = opts.serviceName || 'seu horário';
  const withWho = opts.employeeName ? ` com ${opts.employeeName}` : '';
  const lines = [
    `Oi, ${name}. Lembrete da ${opts.businessName}:`,
    `${service}${withWho} — ${when}.`,
  ];
  const address = (opts.address || '').trim();
  if (address) lines.push(`Endereço: ${address}`);
  lines.push('Até lá.');
  return lines.join('\n');
}

export function buildEmployeeBookingNotify(opts: {
  businessName: string;
  clientName: string;
  serviceName: string;
  slots: Array<{ date: string; time: string }>;
  source: string;
}): string {
  const business = (opts.businessName || '').trim() || 'Estabelecimento';
  const client = (opts.clientName || '').trim() || 'Cliente';
  const service = (opts.serviceName || '').trim() || 'Serviço';
  const header =
    opts.slots.length > 1
      ? `Novos agendamentos na Sof (${business}):`
      : `Novo agendamento na Sof (${business}):`;

  const lines = [header, '', `Cliente: ${client}`, `Serviço: ${service}`];

  if (opts.slots.length === 1) {
    lines.push(
      `Quando: ${formatFriendlyWhen(opts.slots[0].date, opts.slots[0].time)}`,
    );
  } else {
    lines.push('Horários:');
    for (const slot of opts.slots) {
      lines.push(`• ${formatFriendlyWhen(slot.date, slot.time)}`);
    }
  }

  const sourceLabel =
    opts.source === 'whatsapp'
      ? 'Origem: WhatsApp do cliente'
      : opts.source === 'manual'
        ? 'Origem: painel'
        : '';
  if (sourceLabel) {
    lines.push('');
    lines.push(sourceLabel);
  }

  return lines.join('\n');
}

function formatFriendlyWhen(date: string, time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return `${date} às ${time}`;
  const [, y, m, d] = match;
  return `${d}/${m}/${y} às ${time}`;
}
