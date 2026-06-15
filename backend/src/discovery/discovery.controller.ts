import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private discovery: DiscoveryService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: DiscoveryQueryDto) {
    return this.discovery.list(u.userId, q);
  }
}
