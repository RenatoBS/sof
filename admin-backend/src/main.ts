import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(json({ limit: '256kb' }));

  const corsOrigins = config.get<string[]>('corsOrigins') || [
    'http://localhost:8091',
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

  const port = config.get<number>('port') || 3011;
  await app.listen(port);

  const stripeConfigured = Boolean(config.get<string>('stripe.secretKey'));
  console.log(`Sof Admin API rodando em http://localhost:${port}`);
  if (!stripeConfigured) {
    console.log(
      '[stripe] Sem STRIPE_SECRET_KEY — criação de planos exige IDs manuais ou configure a chave.',
    );
  }
}

void bootstrap();
