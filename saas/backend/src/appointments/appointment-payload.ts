import { Account, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isValidPhone, normalizePhone } from '../common/phone';
import { checkWithinOpeningHours } from '../account/opening-hours';
import { hasScheduleConflict, listBusySlots } from './schedule-conflict';
import {
  expandRecurrenceDates,
  parseRecurrenceInput,
  type RecurrenceInput,
} from './recurrence';
import { APPT_STATUS } from './appointment-status';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export type AppointmentKind = 'service' | 'block';

export type AppointmentPayload = {
  kind: AppointmentKind;
  title: string;
  durationMinutes: number | null;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  employeeId: string;
  serviceId: string | null;
  price: number;
  recurrenceGroupId: string | null;
  recurrenceDates: string[];
};

export async function resolveClientForAppointment(
  prisma: PrismaService,
  accountId: string,
  body: Record<string, unknown>,
): Promise<
  | { clientId: string; clientName: string; clientPhone: string }
  | { error: string }
> {
  const clientIdRaw = String(body?.clientId || '').trim();
  if (clientIdRaw) {
    const client = await prisma.client.findFirst({
      where: { id: clientIdRaw, accountId },
    });
    if (!client) return { error: 'Cliente inválido.' };
    return {
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
    };
  }

  const clientName = String(body?.clientName || '').trim();
  const clientPhone = normalizePhone(body?.clientPhone);
  if (!clientName) return { error: 'Informe o nome do cliente.' };
  if (!isValidPhone(clientPhone)) {
    return {
      error: 'Informe o telefone do cliente com DDD (somente números).',
    };
  }

  const client = await prisma.client.upsert({
    where: {
      accountId_phone: { accountId, phone: clientPhone },
    },
    create: {
      accountId,
      name: clientName,
      phone: clientPhone,
    },
    update: { name: clientName },
  });

  return {
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone,
  };
}

function parseKind(body: Record<string, unknown>): AppointmentKind {
  const raw = String(body?.kind || 'service')
    .trim()
    .toLowerCase();
  return raw === 'block' ? 'block' : 'service';
}

export async function validateAppointmentPayload(
  prisma: PrismaService,
  body: Record<string, unknown>,
  account: Account,
  options?: {
    excludeAppointmentId?: string;
    /** Ao editar, não regenera série — usa só a data do body */
    skipRecurrenceExpand?: boolean;
    forceEmployeeId?: string;
  },
): Promise<AppointmentPayload | { error: string }> {
  const kind = parseKind(body);
  const date = String(body?.date || '');
  const time = String(body?.time || '');
  const employeeId = String(options?.forceEmployeeId || body?.employeeId || '');

  if (!DATE_RE.test(date)) return { error: 'Data inválida.' };
  if (!TIME_RE.test(time)) return { error: 'Horário inválido.' };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, accountId: account.id },
  });
  if (!employee) return { error: 'Profissional inválido.' };

  let recurrence: RecurrenceInput | null = null;
  if (!options?.skipRecurrenceExpand) {
    const parsedRecurrence = parseRecurrenceInput(body);
    if (parsedRecurrence && 'error' in parsedRecurrence) {
      return parsedRecurrence;
    }
    recurrence = parsedRecurrence;
  }

  const datesResult = expandRecurrenceDates(date, recurrence);
  if ('error' in datesResult) return datesResult;
  const recurrenceDates = datesResult;
  const recurrenceGroupId = recurrenceDates.length > 1 ? randomUUID() : null;

  if (kind === 'block') {
    const title = String(body?.title || '').trim();
    if (!title) return { error: 'Informe o título do evento.' };

    const durationRaw = body?.durationMinutes ?? body?.duration;
    const durationMinutes = Number(durationRaw);
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 24 * 60
    ) {
      return { error: 'Informe a duração em minutos (mín. 5).' };
    }

    for (const occurrenceDate of recurrenceDates) {
      const busy = await listBusySlots(prisma, {
        accountId: account.id,
        employeeId,
        date: occurrenceDate,
        excludeAppointmentId: options?.excludeAppointmentId,
      });
      if (hasScheduleConflict(busy, time, durationMinutes)) {
        return {
          error:
            recurrenceDates.length > 1
              ? `Conflito de agenda em ${occurrenceDate}. Ajuste o horário ou o período.`
              : 'Este profissional já tem um agendamento nesse horário. Escolha outro horário.',
        };
      }
    }

    return {
      kind: 'block',
      title,
      durationMinutes,
      clientId: null,
      clientName: '',
      clientPhone: '',
      date,
      time,
      employeeId,
      serviceId: null,
      price: 0,
      recurrenceGroupId,
      recurrenceDates,
    };
  }

  const serviceId = String(body?.serviceId || '');
  const clientResolved = await resolveClientForAppointment(
    prisma,
    account.id,
    body,
  );
  if ('error' in clientResolved) return clientResolved;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, accountId: account.id },
  });
  if (!service) return { error: 'Serviço inválido.' };

  const link = await prisma.employeeService.findUnique({
    where: {
      employeeId_serviceId: { employeeId, serviceId },
    },
  });
  if (!link) {
    return { error: 'Este profissional não realiza esse serviço.' };
  }

  for (const occurrenceDate of recurrenceDates) {
    const hoursCheck = checkWithinOpeningHours(
      account.openingHours,
      occurrenceDate,
      time,
      service.duration,
    );
    if (!hoursCheck.ok) {
      if (hoursCheck.reason === 'closed') {
        return {
          error:
            recurrenceDates.length > 1
              ? `O estabelecimento está fechado em ${occurrenceDate} (${hoursCheck.label}).`
              : `O estabelecimento está fechado em ${hoursCheck.label}. Escolha outro dia.`,
        };
      }
      return {
        error: `Horário fora do expediente (${hoursCheck.day.start}–${hoursCheck.day.end}). Escolha outro horário.`,
      };
    }

    const busy = await listBusySlots(prisma, {
      accountId: account.id,
      employeeId,
      date: occurrenceDate,
      excludeAppointmentId: options?.excludeAppointmentId,
    });
    if (hasScheduleConflict(busy, time, service.duration)) {
      return {
        error:
          recurrenceDates.length > 1
            ? `Conflito de agenda em ${occurrenceDate}. Ajuste o horário ou o período.`
            : 'Este profissional já tem um agendamento nesse horário. Escolha outro horário.',
      };
    }
  }

  return {
    kind: 'service',
    title: '',
    durationMinutes: service.duration,
    ...clientResolved,
    date,
    time,
    employeeId,
    serviceId,
    price: service.price,
    recurrenceGroupId,
    recurrenceDates,
  };
}

export function appointmentCreateRows(
  accountId: string,
  payload: AppointmentPayload,
  source = 'manual',
): Prisma.AppointmentCreateManyInput[] {
  const { recurrenceDates, recurrenceGroupId, date: _date, ...base } = payload;

  return recurrenceDates.map((occurrenceDate) => ({
    accountId,
    status: APPT_STATUS.SCHEDULED,
    source,
    ...base,
    date: occurrenceDate,
    recurrenceGroupId,
  }));
}
