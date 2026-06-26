import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { GrowthService } from './growth.service';
import { AwardXpDto, BondDtoIn, ContributeDto, CreateFamilyDto } from './dto/growth.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class GrowthController {
  constructor(private growth: GrowthService) {}

  @Get('growth/me')
  me(@CurrentUser() u: AuthUser) {
    return this.growth.profile(u.userId);
  }

  @Post('growth/award')
  award(@CurrentUser() u: AuthUser, @Body() body: AwardXpDto) {
    return this.growth.award(u.userId, body.amount);
  }

  @Post('growth/bond')
  bond(@CurrentUser() u: AuthUser, @Body() body: BondDtoIn) {
    return this.growth.addBond(u.userId, body.peerId, body.amount);
  }

  @Get('growth/bond/:peerId')
  getBond(@CurrentUser() u: AuthUser, @Param('peerId') peerId: string) {
    return this.growth.getBond(u.userId, peerId);
  }

  @Post('families')
  createFamily(@CurrentUser() u: AuthUser, @Body() body: CreateFamilyDto) {
    return this.growth.createFamily(u.userId, body.name);
  }

  @Post('families/:id/join')
  joinFamily(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.growth.joinFamily(u.userId, id);
  }

  @Post('families/:id/contribute')
  contribute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: ContributeDto) {
    return this.growth.contribute(u.userId, id, body.amount);
  }

  @Get('families/leaderboard')
  leaderboard() {
    return this.growth.leaderboard();
  }
}
