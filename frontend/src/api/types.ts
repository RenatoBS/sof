/** Índice 0 = domingo … 6 = sábado. */
export type DaySchedule = {
  open: boolean;
  start: string;
  end: string;
};

export type OpeningHours = DaySchedule[];

export type Account = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  plan: string;
  planPrice: number;
  whatsappPhoneNumberId: string;
  openingHours: OpeningHours;
  address: string;
  /** Minutos antes do horário (0 = desativado). Default 120. */
  whatsappReminderMinutes?: number;
  /** Fuso IANA da conta. Default America/Sao_Paulo. */
  timezone?: string;
  /** Pausa o bot para todos os clientes. */
  botPausedPermanent?: boolean;
  botPausedUntil?: string | null;
  status: string;
  createdAt: string;
  whatsappConnectedAt?: string | null;
};

export type Service = {
  id: string;
  accountId: string;
  name: string;
  duration: number;
  price: number;
  createdAt: string;
};

export type Employee = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string;
  mustChangePassword: boolean;
  color: string;
  services: Service[];
  createdAt: string;
};

export type EmployeeSession = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string;
  color: string;
  mustChangePassword: boolean;
  businessName: string;
  createdAt: string;
};

export type Client = {
  id: string;
  accountId: string;
  name: string;
  phone: string;
  botPausedPermanent: boolean;
  botPausedUntil?: string | null;
  createdAt: string;
};

export type WhatsappHandoff = {
  id: string;
  accountId: string;
  clientId?: string | null;
  customerPhone: string;
  customerName: string;
  lastMessage: string;
  reason: 'unresolved' | 'human_requested';
  status: 'open' | 'resolved';
  openedAt: string;
  humanRepliedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentKind = 'service' | 'block';

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export type AppointmentRecurrence = {
  frequency: Exclude<RecurrenceFrequency, 'none'>;
  until: string;
};

export type Appointment = {
  id: string;
  accountId: string;
  employeeId: string;
  kind: AppointmentKind;
  title: string;
  durationMinutes?: number | null;
  serviceId?: string | null;
  clientId?: string | null;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  price: number;
  status: string;
  source: 'manual' | 'whatsapp';
  recurrenceGroupId?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

export type AppointmentWriteBody = {
  kind?: AppointmentKind;
  title?: string;
  durationMinutes?: number;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  date: string;
  time: string;
  employeeId: string;
  serviceId?: string;
  recurrence?: AppointmentRecurrence;
};

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export type SupportTicketComment = {
  id: string;
  body: string;
  authorRole: 'account' | 'employee' | 'admin' | string;
  authorName: string;
  authorEmployeeId?: string | null;
  authorAdminId?: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  accountId: string;
  title: string;
  description: string;
  status: SupportTicketStatus | string;
  createdByRole: string;
  createdByEmployeeId?: string | null;
  createdByName: string;
  account?: { id: string; businessName: string; email: string };
  commentCount: number;
  comments?: SupportTicketComment[];
  createdAt: string;
  updatedAt: string;
};
