import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'error' in payload) {
        return res.status(status).json(payload);
      }
      if (typeof payload === 'string') {
        return res.status(status).json({ error: payload });
      }
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload
          ? (payload as { message: string | string[] }).message
          : 'Erro';
      return res.status(status).json({
        error: Array.isArray(message) ? message.join(', ') : message,
      });
    }

    console.error('[admin] Erro não tratado:', exception);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Erro interno do servidor.' });
  }
}
