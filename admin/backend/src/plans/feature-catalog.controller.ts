import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { FEATURE_CATALOG } from '../common/feature-catalog';

@Controller('api/feature-catalog')
@UseGuards(AdminAuthGuard)
export class FeatureCatalogController {
  @Get()
  list() {
    return { features: FEATURE_CATALOG };
  }
}
