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
import { EntitlementsService } from '../entitlements/entitlements.service';

@Controller('api/whatsapp-handoffs')
@UseGuards(AuthGuard)
export class WhatsappHandoffsController {
  constructor(
    private readonly handoffs: WhatsappHandoffsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  async list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoffs = await this.handoffs.list(req.account.id, status);
    return { handoffs };
  }

  @Get('settings')
  async settings(@Req() req: AuthedRequest) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    return this.handoffs.getSettings(req.account.id);
  }

  @Put('settings')
  async updateSettings(
    @Req() req: AuthedRequest,
    @Body() body: { threshold?: number },
  ) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    return this.handoffs.updateSettings(
      req.account.id,
      Number(body?.threshold),
    );
  }

  @Post(':id/resolve')
  async resolve(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoff = await this.handoffs.resolveManual(req.account.id, id);
    return { handoff };
  }
}
