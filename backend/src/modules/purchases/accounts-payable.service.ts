import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

@Injectable()
export class AccountsPayableService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { supplierId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where, take, skip,
        include: {
          supplier: { select: { code: true, name: true } },
          grn: { select: { grnNumber: true, receiptDate: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.accountsPayable.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const ap = await this.prisma.accountsPayable.findUnique({
      where: { id },
      include: {
        supplier: true,
        grn: { select: { grnNumber: true, receiptDate: true, grandTotal: true } },
      },
    });
    if (!ap) throw new NotFoundException('Công nợ phải trả không tồn tại');
    return ap;
  }

  async recordPayment(id: string, amount: number, notes?: string) {
    const ap = await this.findOne(id);
    if (ap.status === PaymentStatus.PAID) throw new BadRequestException('Công nợ đã thanh toán đủ');

    const newPaid = Number(ap.amountPaid) + amount;
    const newRemaining = Number(ap.amountTotal) - newPaid;

    if (newPaid > Number(ap.amountTotal)) {
      throw new BadRequestException('Số tiền thanh toán vượt quá tổng công nợ');
    }

    const isPaid = newRemaining <= 0;
    const status = isPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

    return this.prisma.accountsPayable.update({
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
}
