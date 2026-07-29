import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { WhatsappHandoffsController } from './whatsapp-handoffs.controller';
import { WhatsappHandoffsService } from './whatsapp-handoffs.service';

@Module({
  imports: [forwardRef(() => AuthModule), EntitlementsModule],
  controllers: [WhatsappHandoffsController],
  providers: [WhatsappHandoffsService],
  exports: [WhatsappHandoffsService],
})
export class WhatsappHandoffsModule {}
