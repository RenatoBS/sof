/** Índice 0 = domingo … 6 = sábado. */
export type DaySchedule = {
  open: boolean;
  start: string;
  end: string;
};

export type OpeningHours = DaySchedule[];

export type EntitlementsMap = Record<string, boolean | number | null>;

export type Account = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  plan: string;
  planPrice: number;
  planId?: string | null;
  entitlements?: EntitlementsMap;
  whatsappPhoneNumberId: string;
  openingHours: OpeningHours;
  address: string;
  /** Logo do estabelecimento (data URL base64). */
  logoBase64?: string;
  /** Minutos antes do horário (0 = desativado). Default 120. */
  whatsappReminderMinutes?: number;
  /** Fuso IANA da conta. Default America/Sao_Paulo. */
  timezone?: string;
  /** Pausa o bot para todos os clientes. */
  botPausedPermanent?: boolean;
  botPausedUntil?: string | null;
  status: string;
  /** paid | promo */
  billingSource?: string;
  promoExpiresAt?: string | null;
  /** true quando status === paused (cupom/trial vencido) */
  needsPlanSelection?: boolean;
  /** Bot oferece fluxo de agendamento de serviços (default true). */
  botAttendsServices?: boolean;
  /** Bot oferece fluxo de venda de produtos (default false). */
  botAttendsProducts?: boolean;
  /** Menu inicial: opção “Falar com atendente”. */
  botMenuOfferHuman?: boolean;
  /** Menu inicial: opção de endereço. */
  botMenuShowAddress?: boolean;
  /** Menu inicial: opção de horário de atendimento. */
  botMenuShowHours?: boolean;
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

export type Product = {
  id: string;
  accountId: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  /** Link externo de pagamento do produto (a Sof não cria na Stripe). */
  paymentLinkUrl?: string;
  handoffEnabled: boolean;
  active: boolean;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  productImage?: string;
};

export type Order = {
  id: string;
  accountId: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | string;
  total: number;
  source: string;
  notes: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type Employee = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string;
  mustChangePassword: boolean;
  /** Pode assumir/responder handoffs de clientes no inbox. */
  canHandleHandoffs?: boolean;
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
  canHandleHandoffs?: boolean;
  businessName: string;
  logoBase64?: string;
  createdAt: string;
};

export type Client = {
  id: string;
  accountId: string;
  name: string;
  phone: string;
  botPausedPermanent: boolean;
  botPausedUntil?: string | null;
  /** Pausa aplicada pela Sof (alerta de atendimento / resposta humana). */
  botPausedAuto?: boolean;
  createdAt: string;
};

export type WhatsappHandoff = {
  id: string;
  accountId: string;
  clientId?: string | null;
  employeeId?: string | null;
  /** Quem está na ponta do WhatsApp (default client em registros antigos) */
  party?: 'client' | 'employee' | string | null;
  customerPhone: string;
  customerName: string;
  lastMessage: string;
  reason: 'unresolved' | 'human_requested' | 'product_sale' | string;
  status: 'open' | 'resolved';
  /** null = fila | account = dono | employee = profissional */
  assigneeType?: 'account' | 'employee' | string | null;
  assignedEmployeeId?: string | null;
  assignedAt?: string | null;
  /** Snapshot do motivo (ex.: produto/pedido em product_sale) */
  contextJson?: {
    orderId?: string | null;
    productId?: string | null;
    productName?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    lineTotal?: number | null;
    total?: number | null;
    status?: string | null;
    paymentLinkUrl?: string | null;
  } | null;
  openedAt: string;
  humanRepliedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WhatsappMessage = {
  id: string;
  accountId: string;
  handoffId?: string | null;
  customerPhone: string;
  direction: 'inbound' | 'outbound' | string;
  senderKind: 'client' | 'employee_party' | 'bot' | 'human_wa' | 'agent' | string;
  body: string;
  agentEmployeeId?: string | null;
  sentByAccountOwner?: boolean;
  providerMessageId?: string | null;
  createdAt: string;
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
  /** Só vem nas listagens do portal do profissional; no painel use o catálogo local. */
  serviceName?: string | null;
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
