import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FlagsController } from './flags.controller';
import { FlagsService } from './flags.service';

@Module({
  imports: [AuditModule],
  controllers: [FlagsController],
  providers: [FlagsService],
})
export class FlagsModule {}
