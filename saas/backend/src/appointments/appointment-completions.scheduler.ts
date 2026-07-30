import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppointmentCompletionsService } from './appointment-completions.service';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

@Injectable()
export class AppointmentCompletionsScheduler implements OnModuleInit {
  private readonly logger = new Logger(AppointmentCompletionsScheduler.name);

  constructor(private readonly completions: AppointmentCompletionsService) {}

  onModuleInit() {
    setTimeout(() => {
      void this.tick('bootstrap');
    }, 8_000);
  }

  @Interval(FIVE_MINUTES_MS)
  async handleInterval() {
    await this.tick('interval');
  }

  private async tick(reason: string) {
    try {
      await this.completions.processDueCompletions();
    } catch (err) {
      this.logger.error(
        `Erro no job de conclusão (${reason}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
