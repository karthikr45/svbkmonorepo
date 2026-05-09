import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementsRepository: Repository<Announcement>,
  ) {}

  async create(_tenantId: string, _dto: CreateAnnouncementDto): Promise<Announcement> {
    // TODO: implement — tenantId from JWT
    throw new Error('Not implemented');
  }

  async findAll(_tenantId: string): Promise<Announcement[]> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findOne(_tenantId: string, _id: string): Promise<Announcement> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async update(_tenantId: string, _id: string, _dto: UpdateAnnouncementDto): Promise<Announcement> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async remove(_tenantId: string, _id: string): Promise<void> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
