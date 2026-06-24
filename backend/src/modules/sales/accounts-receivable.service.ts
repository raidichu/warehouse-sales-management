import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

@Injectable()
export class AccountsReceivableService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { customerId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.accountsReceivable.findMany({
        where, take, skip,
        include: {
          customer: { select: { code: true, name: true } },
          invoice: { select: { invoiceNumber: true, invoiceDate: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.accountsReceivable.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const ar = await this.prisma.accountsReceivable.findUnique({
      where: { id },
      include: {
        customer: true,
        invoice: { select: { invoiceNumber: true, invoiceDate: true, grandTotal: true } },
      },
    });
    if (!ar) throw new NotFoundException('Công nợ phải thu không tồn tại');
    return ar;
  }

  async recordPayment(id: string, amount: number, notes?: string) {
    const ar = await this.findOne(id);
    if (ar.status === PaymentStatus.PAID) throw new BadRequestException('Công nợ đã thanh toán đủ');

    const newPaid = Number(ar.amountPaid) + amount;
    const newRemaining = Number(ar.amountTotal) - newPaid;

    if (newPaid > Number(ar.amountTotal)) {
      throw new BadRequestException('Số tiền thanh toán vượt quá tổng công nợ');
    }

    const isPaid = newRemaining <= 0;
    const status = isPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

    return this.prisma.accountsReceivable.update({
      where: { id },
      data: {
        amountPaid: newPaid,
        amountRemaining: Math.max(0, newRemaining),
        status,
        paymentDate: isPaid ? new Date() : undefined,
        notes,
      },
    });
  }

  async getAgingSummary() {
    const now = new Date();
    const records = await this.prisma.accountsReceivable.findMany({
      where: { status: { not: PaymentStatus.PAID } },
      include: { customer: { select: { code: true, name: true } } },
    });

    return records.map((r) => {
      const overdueDays = Math.max(0, Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000));
      const bucket =
        overdueDays === 0 ? 'current'
          : overdueDays <= 30 ? '1-30'
            : overdueDays <= 60 ? '31-60'
              : overdueDays <= 90 ? '61-90'
                : '90+';
      return { ...r, overdueDays, bucket };
    });
  }
}
