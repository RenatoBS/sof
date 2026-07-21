import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';
import { EmployeesModule } from './employees/employees.module';
import { ServicesModule } from './services/services.module';
import { ClientsModule } from './clients/clients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentsModule } from './payments/payments.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { WhatsappHandoffsModule } from './whatsapp-handoffs/whatsapp-handoffs.module';
import { RemindersModule } from './reminders/reminders.module';
import { EventsModule } from './events/events.module';
import { EmployeePortalModule } from './employee-portal/employee-portal.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 300,
      },
    ]),
    PrismaModule,
    AuthModule,
    AccountModule,
    EmployeesModule,
    ServicesModule,
    ClientsModule,
    AppointmentsModule,
    CheckoutModule,
    PaymentsModule,
    WhatsappModule,
    WhatsappHandoffsModule,
    RemindersModule,
    EventsModule,
    EmployeePortalModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
