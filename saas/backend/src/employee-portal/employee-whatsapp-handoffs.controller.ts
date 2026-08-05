import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  EmployeeAuthGuard,
  type EmployeeAuthedRequest,
} from '../employee-portal/employee-auth.guard';
import { WhatsappHandoffsService } from '../whatsapp-handoffs/whatsapp-handoffs.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { hasFeature } from '../entitlements/feature-catalog';

@Controller('api/employee/whatsapp-handoffs')
@UseGuards(EmployeeAuthGuard)
export class EmployeeWhatsappHandoffsController {
  constructor(
    private readonly handoffs: WhatsappHandoffsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async assertEmployeeAccess(req: EmployeeAuthedRequest) {
    const ents = await this.entitlements.forAccount(req.account.id);
    if (!hasFeature(ents, 'handoffs')) {
      throw new ForbiddenException({
        error: 'Plano sem atendimentos.',
        code: 'PLAN_FEATURE_REQUIRED',
      });
    }
    if (!req.employee.canHandleHandoffs) {
      throw new ForbiddenException({
        error: 'Você não está habilitado para atendimentos.',
      });
    }
  }

  private actor(req: EmployeeAuthedRequest) {
    return { kind: 'employee' as const, employeeId: req.employee.id };
  }

  @Get()
  async list(
    @Req() req: EmployeeAuthedRequest,
    @Query('status') status?: string,
  ) {
    await this.assertEmployeeAccess(req);
    const handoffs = await this.handoffs.list(req.account.id, status, {
      party: 'client',
      forEmployeeId: req.employee.id,
    });
    return { handoffs };
  }

  @Get(':id/messages')
  async messages(
    @Req() req: EmployeeAuthedRequest,
    @Param('id') id: string,
  ) {
    await this.assertEmployeeAccess(req);
    const messages = await this.handoffs.listMessages(req.account.id, id);
    return { messages };
  }

  @Post(':id/reply')
  async reply(
    @Req() req: EmployeeAuthedRequest,
    @Param('id') id: string,
    @Body() body: { text?: string },
  ) {
    await this.assertEmployeeAccess(req);
    return this.handoffs.reply(
      req.account.id,
      id,
      String(body?.text || ''),
      this.actor(req),
    );
  }

  @Post(':id/claim')
  async claim(@Req() req: EmployeeAuthedRequest, @Param('id') id: string) {
    await this.assertEmployeeAccess(req);
    const handoff = await this.handoffs.claim(
      req.account.id,
      id,
      this.actor(req),
    );
    return { handoff };
  }

  @Post(':id/transfer')
  async transfer(
    @Req() req: EmployeeAuthedRequest,
    @Param('id') id: string,
    @Body() body: { assigneeType?: string; employeeId?: string },
  ) {
    await this.assertEmployeeAccess(req);
    const handoff = await this.handoffs.transfer(
      req.account.id,
      id,
      body || {},
      this.actor(req),
    );
    return { handoff };
  }

  @Post(':id/release')
  async release(@Req() req: EmployeeAuthedRequest, @Param('id') id: string) {
    await this.assertEmployeeAccess(req);
    const handoff = await this.handoffs.release(
      req.account.id,
      id,
      this.actor(req),
    );
    return { handoff };
  }

  @Post(':id/resolve')
  async resolve(@Req() req: EmployeeAuthedRequest, @Param('id') id: string) {
    await this.assertEmployeeAccess(req);
    const handoff = await this.handoffs.resolveManual(
      req.account.id,
      id,
      this.actor(req),
    );
    return { handoff };
  }

  @Post(':id/return-to-sof')
  async returnToSof(
    @Req() req: EmployeeAuthedRequest,
    @Param('id') id: string,
  ) {
    await this.assertEmployeeAccess(req);
    const handoff = await this.handoffs.returnToSof(
      req.account.id,
      id,
      this.actor(req),
    );
    return { handoff };
  }
}
