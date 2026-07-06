const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const checkoutRoutes = require('./routes/checkout');
const paymentsRoutes = require('./routes/payments');
const employeesRoutes = require('./routes/employees');
const servicesRoutes = require('./routes/services');
const appointmentsRoutes = require('./routes/appointments');
const whatsappRoutes = require('./routes/whatsapp');
const eventsRoutes = require('./routes/events');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
    })
  );

  app.use(cookieParser());

  // Captura o corpo bruto da requisição — necessário para validar a assinatura
  // (X-Hub-Signature-256) enviada pela Meta no webhook do WhatsApp.
  app.use(
    express.json({
      limit: '256kb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
  app.use('/api', apiLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/services', servicesRoutes);
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/events', eventsRoutes);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/dashboard', express.static(path.join(PUBLIC_DIR, 'dashboard')));
  app.get('/dashboard/*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'dashboard', 'index.html')));

  app.use('/site', express.static(path.join(PUBLIC_DIR, 'site')));
  app.use(express.static(path.join(PUBLIC_DIR, 'site')));
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'site', 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('[app] Erro não tratado:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = { createApp, config };
