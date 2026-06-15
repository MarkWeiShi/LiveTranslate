import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { BlocksService } from './blocks.service';
import { ReportsService } from './reports.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReportDto } from './dto/create-report.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(
    private blocks: BlocksService,
    private reports: ReportsService,
  ) {}

  @Post('reports')
  createReport(@CurrentUser() u: AuthUser, @Body() body: CreateReportDto) {
    return this.reports.create(u.userId, body);
  }

  @Post('blocks')
  createBlock(@CurrentUser() u: AuthUser, @Body() body: CreateBlockDto) {
    return this.blocks.create(u.userId, body.blockedUserId);
  }

  @Get('blocks')
  listBlocks(@CurrentUser() u: AuthUser) {
    return this.blocks.list(u.userId);
  }

  @Delete('blocks/:id')
  @HttpCode(204)
  async removeBlock(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.blocks.remove(u.userId, id);
  }
}
