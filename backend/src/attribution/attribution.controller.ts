import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { channelFromSource } from '@linku/shared';
import { AttributionService } from './attribution.service';
import { CreateAttributionDto, CreateFunnelEventDto } from './dto/create-attribution.dto';
import { AgentTokenGuard } from '../translation/agent-token.guard';

@Controller()
export class AttributionController {
  constructor(private attribution: AttributionService) {}

  // Public：H5 启动归因（telegram initData / x·messenger·ig 的 UTM 外链）。
  @Post('attribution')
  record(@Body() body: CreateAttributionDto) {
    return this.attribution.record(body);
  }

  // Public：上报漏斗阶段事件（signup/activate）。
  @Post('attribution/event')
  event(@Body() body: CreateFunnelEventDto) {
    return this.attribution.recordEvent(body);
  }

  // Internal：渠道 land 计数（agent token 守卫）。
  @Get('internal/attribution/count')
  @UseGuards(AgentTokenGuard)
  async count(@Query('source') source = 'telegram') {
    const channel = channelFromSource(source);
    return { source, channel, count: await this.attribution.countBySource(channel) };
  }

  // Internal：多渠道转化漏斗（land→signup→activate + 转化率）。
  @Get('internal/attribution/funnel')
  @UseGuards(AgentTokenGuard)
  funnel() {
    return this.attribution.funnel();
  }
}
