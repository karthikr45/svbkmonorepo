import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParentPortalService } from './parent-portal.service';

@ApiTags('parent-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARENT)
@Controller('parent')
export class ParentPortalController {
  constructor(private readonly portal: ParentPortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Logged-in parent profile' })
  me(@CurrentUser() user: any) {
    return this.portal.me(user.tenantId, user.userId);
  }

  @Get('students')
  @ApiOperation({ summary: 'List of children for the logged-in parent' })
  students(@CurrentUser() user: any) {
    return this.portal.listChildren(user.tenantId, user.userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Parent dashboard summary' })
  dashboard(@CurrentUser() user: any) {
    return this.portal.dashboard(user.tenantId, user.userId);
  }

  @Get('fees')
  @ApiOperation({ summary: 'List fees for parent\'s children (optionally filter by studentId)' })
  fees(
    @CurrentUser() user: any,
    @Query('studentId') studentId?: string,
  ) {
    return this.portal.listFees(user.tenantId, user.userId, studentId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List of payments tied to the parent\'s children' })
  payments(@CurrentUser() user: any) {
    return this.portal.listPayments(user.tenantId, user.userId);
  }
}
