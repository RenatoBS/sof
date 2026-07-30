import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

@Injectable()
export class RealtimeService {
  private readonly clientsByAccount = new Map<string, Set<Response>>();

  subscribe(accountId: string, res: Response) {
    if (!this.clientsByAccount.has(accountId)) {
      this.clientsByAccount.set(accountId, new Set());
    }
    this.clientsByAccount.get(accountId)!.add(res);
  }

  unsubscribe(accountId: string, res: Response) {
    const set = this.clientsByAccount.get(accountId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) this.clientsByAccount.delete(accountId);
  }

  broadcast(accountId: string, event: string, payload: unknown) {
    const set = this.clientsByAccount.get(accountId);
    if (!set || set.size === 0) return;
    const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
      res.write(chunk);
    }
  }
}
