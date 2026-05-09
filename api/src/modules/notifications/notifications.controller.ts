import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  send(@CurrentUser() _user: any, @Body() _dto: CreateNotificationDto) {
    // TODO: implement
  }

  @Get()
  findAll(@CurrentUser() _user: any) {
    // TODO: implement
  }

  @Patch(':id/read')
  markRead(@CurrentUser() _user: any, @Param('id') _id: string) {
    // TODO: implement
  }

  @Delete(':id')
  remove(@CurrentUser() _user: any, @Param('id') _id: string) {
    // TODO: implement
  }
}
