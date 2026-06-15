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
import { CreateBlockDto } from './dto/create-block.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private blocks: BlocksService) {}

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
