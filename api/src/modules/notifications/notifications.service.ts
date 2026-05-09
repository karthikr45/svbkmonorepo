import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async send(_tenantId: string, _dto: CreateNotificationDto): Promise<Notification> {
    // TODO: implement — tenantId from JWT
    throw new Error('Not implemented');
  }

  async findAll(_tenantId: string, _userId: string): Promise<Notification[]> {
    // TODO: implement — return notifications for user
    throw new Error('Not implemented');
  }

  async markRead(_tenantId: string, _id: string): Promise<Notification> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async remove(_tenantId: string, _id: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
