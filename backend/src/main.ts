import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(
    json({
      limit: '256kb',
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  const corsOrigins = config.get<string[]>('corsOrigins') || [
    'http://localhost:8081',
  ];
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const port = config.get<number>('port') || 3001;
  await app.listen(port);

  const stripeConfigured = Boolean(config.get<string>('stripe.secretKey'));
  const waConfigured = Boolean(
    config.get<string>('whatsapp.token') &&
      config.get<string>('whatsapp.phoneNumberId'),
  );

  console.log(`Sof API rodando em http://localhost:${port}`);
  if (!stripeConfigured) {
    console.log(
      '[stripe] Modo demonstração ativo — configure STRIPE_SECRET_KEY no .env para cobrar de verdade.',
    );
  }
  if (!waConfigured) {
    console.log(
      '[whatsapp] Bot desativado — configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env.',
    );
  }
}

void bootstrap();
