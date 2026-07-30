import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

@Injectable()
export class RemindersScheduler implements OnModuleInit {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly reminders: RemindersService) {}

  onModuleInit() {
    // Roda logo após o boot (não espera o primeiro intervalo).
    setTimeout(() => {
      void this.tick('bootstrap');
    }, 5_000);
  }

  @Interval(THIRTY_MINUTES_MS)
  async handleInterval() {
    await this.tick('interval');
  }

  private async tick(reason: string) {
    try {
      await this.reminders.processDueReminders();
    } catch (err) {
      this.logger.error(
        `Erro no job de lembretes (${reason}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
