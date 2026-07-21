import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { WhatsappHandoffsService } from './whatsapp-handoffs.service';

@Controller('api/whatsapp-handoffs')
@UseGuards(AuthGuard)
export class WhatsappHandoffsController {
  constructor(private readonly handoffs: WhatsappHandoffsService) {}

  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
  ) {
    const handoffs = await this.handoffs.list(req.account.id, status);
    return { handoffs };
  }

  @Get('settings')
  async settings(@Req() req: AuthedRequest) {
    return this.handoffs.getSettings(req.account.id);
  }

  @Put('settings')
  async updateSettings(
    @Req() req: AuthedRequest,
    @Body() body: { threshold?: number },
  ) {
    return this.handoffs.updateSettings(
      req.account.id,
      Number(body?.threshold),
    );
  }

  @Post(':id/resolve')
  async resolve(@Req() req: AuthedRequest, @Param('id') id: string) {
    const handoff = await this.handoffs.resolveManual(req.account.id, id);
    return { handoff };
  }
}
