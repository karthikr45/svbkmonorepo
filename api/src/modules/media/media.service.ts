import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  async upload(_tenantId: string, _file: Express.Multer.File): Promise<Media> {
    // TODO: upload to Cloudinary, persist record — tenantId from JWT
    throw new Error('Not implemented');
  }

  async findAll(_tenantId: string): Promise<Media[]> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async findOne(_tenantId: string, _id: string): Promise<Media> {
    // TODO: implement
    throw new Error('Not implemented');
  }

  async remove(_tenantId: string, _id: string): Promise<void> {
    // TODO: delete from Cloudinary and DB
    throw new Error('Not implemented');
  }
}
