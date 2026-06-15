import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AgentTokenGuard } from './agent-token.guard';
import { TranslationSessionService } from './translation-session.service';
import { ReportTranslatedDto } from './dto/report-translated.dto';

// Internal endpoints — guarded by AGENT_INGRESS_TOKEN. Used by the real Python agent (real mode)
// and by tests/dev to inject faults (AC-XLATE-2). NOT for end-user clients.
@Controller('internal')
@UseGuards(AgentTokenGuard)
export class TranslationController {
  constructor(private translation: TranslationSessionService) {}

  @Post('agent/report')
  @HttpCode(204)
  async report(@Body() body: ReportTranslatedDto) {
    await this.translation.reportFromAgent(body);
  }

  @Post('translation/fault')
  @HttpCode(204)
  fault(@Body() body: { callId: string; fault: 'latency' | 'fail' | 'none' }) {
    this.translation.injectFault(body.callId, body.fault);
  }
}
