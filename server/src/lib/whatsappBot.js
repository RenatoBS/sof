const db = require('../db');
const { id } = require('../lib/id');
const realtime = require('./realtime');

// Máquina de estados simples que replica, via texto no WhatsApp, o mesmo fluxo mostrado na
// vitrine do site (escolher serviço -> escolher profissional -> confirmar horário). Quando o
// cliente confirma, o agendamento é criado direto no dashboard (fonte: "whatsapp") e um evento
// em tempo real (SSE) é disparado para quem estiver com o painel aberto.

function sessionKeyFor(accountId, customerPhone) {
  return `${accountId}:${customerPhone}`;
}

function getSession(accountId, customerPhone) {
  const key = sessionKeyFor(accountId, customerPhone);
  return db.whatsappSessions.find((s) => s.id === key) || null;
}

function saveSession(accountId, customerPhone, patch) {
  const key = sessionKeyFor(accountId, customerPhone);
  const existing = getSession(accountId, customerPhone);
  if (existing) return db.whatsappSessions.update(key, patch);
  return db.whatsappSessions.insert({ id: key, accountId, customerPhone, step: 'start', data: {}, ...patch });
}

function resetSession(accountId, customerPhone) {
  saveSession(accountId, customerPhone, { step: 'start', data: {} });
}

function listMenu(items, label) {
  return items.map((item, idx) => `${idx + 1}. ${label(item)}`).join('\n');
}

function parseChoice(text, max) {
  const n = parseInt(String(text).trim(), 10);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}

const DATETIME_RE = /(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/;

function parseDateTime(text) {
  const match = String(text).match(DATETIME_RE);
  if (!match) return null;
  const [, dd, mm, hh, min] = match.map(Number);
  const year = new Date().getFullYear();
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) return null;
  const date = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const time = `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  return { date, time };
}

const AFFIRMATIVE = ['sim', 's', 'confirmar', 'confirmo', 'ok', 'fecha', 'fechado'];
const NEGATIVE = ['não', 'nao', 'n', 'cancelar'];

// account: registro completo da conta (dono do WhatsApp Business). customerPhone: número do cliente final.
function handleIncomingMessage({ account, customerPhone, text }) {
  const trimmed = String(text || '').trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'cancelar') {
    resetSession(account.id, customerPhone);
    return { replies: ['Combinado, cancelei o que estava em andamento. É só chamar de novo quando quiser marcar um horário.'] };
  }

  const services = db.services.filter((s) => s.accountId === account.id);
  const employees = db.employees.filter((e) => e.accountId === account.id);

  if (services.length === 0 || employees.length === 0) {
    return {
      replies: ['Esse salão ainda está configurando o agendamento por aqui. Peça para tentarem de novo em instantes ou contate o número do salão.'],
    };
  }

  let session = getSession(account.id, customerPhone);
  const step = session?.step || 'start';

  if (step === 'start') {
    saveSession(account.id, customerPhone, { step: 'awaiting_service', data: {} });
    return {
      replies: [
        `Oi! Aqui é a Soft, do ${account.businessName}. Qual serviço você quer agendar?\n${listMenu(services, (s) => `${s.name} (${s.duration}min)`)}\n\nResponda com o número da opção.`,
      ],
    };
  }

  if (step === 'awaiting_service') {
    const idx = parseChoice(trimmed, services.length);
    if (idx === null) {
      return { replies: [`Não entendi. Responda com o número do serviço:\n${listMenu(services, (s) => s.name)}`] };
    }
    const service = services[idx];
    saveSession(account.id, customerPhone, { step: 'awaiting_employee', data: { serviceId: service.id } });
    return {
      replies: [`Combinado: ${service.name}. Com qual profissional?\n${listMenu(employees, (e) => `${e.name} — ${e.specialty}`)}`],
    };
  }

  if (step === 'awaiting_employee') {
    const idx = parseChoice(trimmed, employees.length);
    if (idx === null) {
      return { replies: [`Não entendi. Responda com o número do profissional:\n${listMenu(employees, (e) => e.name)}`] };
    }
    const employee = employees[idx];
    saveSession(account.id, customerPhone, {
      step: 'awaiting_datetime',
      data: { ...session.data, employeeId: employee.id },
    });
    return { replies: [`Para quando? Me diga a data e o horário assim: 25/12 15:00`] };
  }

  if (step === 'awaiting_datetime') {
    const when = parseDateTime(trimmed);
    if (!when) {
      return { replies: ['Não consegui entender a data. Envie no formato dd/mm hh:mm, por exemplo: 25/12 15:00'] };
    }
    const service = services.find((s) => s.id === session.data.serviceId);
    const employee = employees.find((e) => e.id === session.data.employeeId);
    saveSession(account.id, customerPhone, {
      step: 'awaiting_confirmation',
      data: { ...session.data, ...when },
    });
    return {
      replies: [
        `Fechar ${service.name} com ${employee.name} em ${when.date.split('-').reverse().join('/')} às ${when.time}? (responda sim ou não)`,
      ],
    };
  }

  if (step === 'awaiting_confirmation') {
    if (AFFIRMATIVE.includes(lower)) {
      const { serviceId, employeeId, date, time } = session.data;
      const service = services.find((s) => s.id === serviceId);
      const appointment = db.appointments.insert({
        id: id('apt'),
        accountId: account.id,
        employeeId,
        serviceId,
        clientName: `Cliente WhatsApp ${customerPhone.slice(-4)}`,
        clientPhone: customerPhone,
        date,
        time,
        price: service.price,
        status: 'confirmed',
        source: 'whatsapp',
        createdAt: new Date().toISOString(),
      });
      resetSession(account.id, customerPhone);
      realtime.broadcast(account.id, 'appointment:created', { appointment });
      return {
        replies: ['Marcado! Você recebe um lembrete antes do horário. Até lá!'],
        appointment,
      };
    }
    if (NEGATIVE.includes(lower)) {
      resetSession(account.id, customerPhone);
      return { replies: ['Sem problemas, não marquei nada. É só chamar de novo quando quiser agendar.'] };
    }
    return { replies: ['Responda "sim" para confirmar ou "não" para cancelar.'] };
  }

  resetSession(account.id, customerPhone);
  return { replies: ['Vamos recomeçar — qual serviço você quer agendar?'] };
}

module.exports = { handleIncomingMessage, resetSession };
