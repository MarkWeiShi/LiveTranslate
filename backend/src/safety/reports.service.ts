import { Injectable } from '@nestjs/common';
import type { CreateReportBody } from '@linku/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async create(reporterId: string, body: CreateReportBody) {
    const r = await this.prisma.report.create({
      data: {
        reporterId,
        targetId: body.targetId,
        callId: body.callId,
        reason: body.reason,
        detail: body.detail,
      },
    });
    return { id: r.id, createdAt: r.createdAt.toISOString() };
  }
}
