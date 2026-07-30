-- Weekly opening hours per account (0=Sunday … 6=Saturday).
-- Default: Mon–Sat 09:00–18:00, Sunday closed.

ALTER TABLE "Account" ADD COLUMN "openingHours" JSONB NOT NULL DEFAULT '[
  {"open":false,"start":"09:00","end":"18:00"},
  {"open":true,"start":"09:00","end":"18:00"},
  {"open":true,"start":"09:00","end":"18:00"},
  {"open":true,"start":"09:00","end":"18:00"},
  {"open":true,"start":"09:00","end":"18:00"},
  {"open":true,"start":"09:00","end":"18:00"},
  {"open":true,"start":"09:00","end":"18:00"}
]'::jsonb;
