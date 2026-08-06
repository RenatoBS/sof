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

  private actor() {
    return { kind: 'account' as const };
  }

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

  @Get(':id/messages')
  async messages(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const messages = await this.handoffs.listMessages(req.account.id, id);
    return { messages };
  }

  @Post(':id/reply')
  async reply(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { text?: string },
  ) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    return this.handoffs.reply(
      req.account.id,
      id,
      String(body?.text || ''),
      this.actor(),
    );
  }

  @Post(':id/claim')
  async claim(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoff = await this.handoffs.claim(
      req.account.id,
      id,
      this.actor(),
    );
    return { handoff };
  }

  @Post(':id/transfer')
  async transfer(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { assigneeType?: string; employeeId?: string },
  ) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoff = await this.handoffs.transfer(
      req.account.id,
      id,
      body || {},
      this.actor(),
    );
    return { handoff };
  }

  @Post(':id/release')
  async release(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoff = await this.handoffs.release(
      req.account.id,
      id,
      this.actor(),
    );
    return { handoff };
  }

  @Post(':id/resolve')
  async resolve(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoff = await this.handoffs.resolveManual(
      req.account.id,
      id,
      this.actor(),
    );
    return { handoff };
  }

  @Post(':id/return-to-sof')
  async returnToSof(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.entitlements.assertFeature(req.account.id, 'handoffs');
    const handoff = await this.handoffs.returnToSof(
      req.account.id,
      id,
      this.actor(),
    );
    return { handoff };
  }
}
