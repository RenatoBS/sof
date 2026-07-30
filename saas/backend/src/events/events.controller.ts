import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { RealtimeService } from './realtime.service';

@Controller('api/events')
export class EventsController {
  constructor(private readonly realtime: RealtimeService) {}

  @Get('stream')
  @UseGuards(AuthGuard)
  stream(@Req() req: AuthedRequest, @Res() res: Response) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');

    this.realtime.subscribe(req.account.id, res);

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      this.realtime.unsubscribe(req.account.id, res);
    });
  }
}
