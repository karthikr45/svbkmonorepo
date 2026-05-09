import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() _user: any,
    @UploadedFile() _file: Express.Multer.File,
  ) {
    // TODO: implement
  }

  @Get()
  findAll(@CurrentUser() _user: any) {
    // TODO: implement
  }

  @Get(':id')
  findOne(@CurrentUser() _user: any, @Param('id') _id: string) {
    // TODO: implement
  }

  @Delete(':id')
  remove(@CurrentUser() _user: any, @Param('id') _id: string) {
    // TODO: implement
  }
}
