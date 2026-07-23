const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function isTicketStatus(value: unknown): value is TicketStatus {
  return (
    typeof value === 'string' &&
    (TICKET_STATUSES as readonly string[]).includes(value)
  );
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

type CommentRow = {
  id: string;
  body: string;
  authorRole: string;
  authorEmployeeId: string | null;
  authorAdminId: string | null;
  createdAt: Date;
  authorEmployee?: { id: string; name: string } | null;
  authorAdmin?: { id: string; name: string; email: string } | null;
};

type TicketRow = {
  id: string;
  accountId: string;
  title: string;
  description: string;
  status: string;
  createdByRole: string;
  createdByEmployeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByEmployee?: { id: string; name: string } | null;
  account?: {
    id: string;
    businessName: string;
    email: string;
  };
  comments?: CommentRow[];
  _count?: { comments: number };
};

export function publicComment(comment: CommentRow) {
  let authorName = 'Conta';
  if (comment.authorRole === 'employee') {
    authorName = comment.authorEmployee?.name || 'Profissional';
  } else if (comment.authorRole === 'admin') {
    authorName = comment.authorAdmin?.name || 'Sof';
  }

  return {
    id: comment.id,
    body: comment.body,
    authorRole: comment.authorRole,
    authorName,
    authorEmployeeId: comment.authorEmployeeId,
    authorAdminId: comment.authorAdminId,
    createdAt: comment.createdAt.toISOString(),
  };
}

export function publicTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    accountId: ticket.accountId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    createdByRole: ticket.createdByRole,
    createdByEmployeeId: ticket.createdByEmployeeId,
    createdByName:
      ticket.createdByRole === 'employee'
        ? ticket.createdByEmployee?.name || 'Profissional'
        : ticket.account?.businessName || 'Conta',
    account: ticket.account
      ? {
          id: ticket.account.id,
          businessName: ticket.account.businessName,
          email: ticket.account.email,
        }
      : undefined,
    commentCount: ticket._count?.comments ?? ticket.comments?.length ?? 0,
    comments: ticket.comments?.map(publicComment),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export const ticketCommentInclude = {
  authorEmployee: { select: { id: true, name: true } },
  authorAdmin: { select: { id: true, name: true, email: true } },
} as const;

export const ticketListInclude = {
  createdByEmployee: { select: { id: true, name: true } },
  account: { select: { id: true, businessName: true, email: true } },
  _count: { select: { comments: true } },
} as const;

export const ticketDetailInclude = {
  createdByEmployee: { select: { id: true, name: true } },
  account: { select: { id: true, businessName: true, email: true } },
  comments: {
    include: ticketCommentInclude,
    orderBy: { createdAt: 'asc' as const },
  },
} as const;
