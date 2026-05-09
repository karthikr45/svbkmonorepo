import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';
import { Penalty } from './entities/penalty.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Penalty])],
  controllers: [PenaltiesController],
  providers: [PenaltiesService],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
