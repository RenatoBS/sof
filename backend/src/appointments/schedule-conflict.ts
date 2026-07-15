import { PrismaService } from '../prisma/prisma.service';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function rangesOverlap(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number,
): boolean {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return startA < endB && startB < endA;
}

type BusySlot = { time: string; duration: number };

export async function listBusySlots(
  prisma: PrismaService,
  params: {
    accountId: string;
    employeeId: string;
    date: string;
    excludeAppointmentId?: string;
  },
): Promise<BusySlot[]> {
  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: params.accountId,
      employeeId: params.employeeId,
      date: params.date,
      status: 'confirmed',
      ...(params.excludeAppointmentId
        ? { id: { not: params.excludeAppointmentId } }
        : {}),
    },
    include: { service: { select: { duration: true } } },
  });

  return appointments.map((a) => ({
    time: a.time,
    duration: a.service?.duration || 30,
  }));
}

export function hasScheduleConflict(
  busy: BusySlot[],
  startTime: string,
  durationMinutes: number,
): boolean {
  const start = timeToMinutes(startTime);
  return busy.some((slot) =>
    rangesOverlap(start, durationMinutes, timeToMinutes(slot.time), slot.duration),
  );
}

/** Sugere até `limit` horários livres no mesmo dia (09:00–18:00, passo 30 min). */
export function suggestFreeTimes(
  busy: BusySlot[],
  durationMinutes: number,
  limit = 3,
): string[] {
  const dayStart = 9 * 60;
  const dayEnd = 18 * 60;
  const step = 30;
  const suggestions: string[] = [];

  for (let t = dayStart; t + durationMinutes <= dayEnd; t += step) {
    const time = minutesToTime(t);
    if (!hasScheduleConflict(busy, time, durationMinutes)) {
      suggestions.push(time);
      if (suggestions.length >= limit) break;
    }
  }

  return suggestions;
}
