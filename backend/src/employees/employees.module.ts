import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeePortalModule } from '../employee-portal/employee-portal.module';
import { EmployeesController } from './employees.controller';

@Module({
  imports: [AuthModule, EmployeePortalModule],
  controllers: [EmployeesController],
})
export class EmployeesModule {}
