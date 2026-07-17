import { Account } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isValidPhone, normalizePhone } from '../common/phone';
import { checkWithinOpeningHours } from '../account/opening-hours';
import { hasScheduleConflict, listBusySlots } from './schedule-conflict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export type AppointmentPayload = {
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  employeeId: string;
  serviceId: string;
  price: number;
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

export async function validateAppointmentPayload(
  prisma: PrismaService,
  body: Record<string, unknown>,
  account: Account,
  options?: {
    excludeAppointmentId?: string;
    forceEmployeeId?: string;
  },
): Promise<AppointmentPayload | { error: string }> {
  const date = String(body?.date || '');
  const time = String(body?.time || '');
  const employeeId = String(
    options?.forceEmployeeId || body?.employeeId || '',
  );
  const serviceId = String(body?.serviceId || '');

  if (!DATE_RE.test(date)) return { error: 'Data inválida.' };
  if (!TIME_RE.test(time)) return { error: 'Horário inválido.' };

  const clientResolved = await resolveClientForAppointment(
    prisma,
    account.id,
    body,
  );
  if ('error' in clientResolved) return clientResolved;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, accountId: account.id },
  });
  if (!employee) return { error: 'Profissional inválido.' };

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

  const hoursCheck = checkWithinOpeningHours(
    account.openingHours,
    date,
    time,
    service.duration,
  );
  if (!hoursCheck.ok) {
    if (hoursCheck.reason === 'closed') {
      return {
        error: `O estabelecimento está fechado em ${hoursCheck.label}. Escolha outro dia.`,
      };
    }
    return {
      error: `Horário fora do expediente (${hoursCheck.day.start}–${hoursCheck.day.end}). Escolha outro horário.`,
    };
  }

  const busy = await listBusySlots(prisma, {
    accountId: account.id,
    employeeId,
    date,
    excludeAppointmentId: options?.excludeAppointmentId,
  });
  if (hasScheduleConflict(busy, time, service.duration)) {
    return {
      error:
        'Este profissional já tem um agendamento nesse horário. Escolha outro horário.',
    };
  }

  return {
    ...clientResolved,
    date,
    time,
    employeeId,
    serviceId,
    price: service.price,
  };
}
