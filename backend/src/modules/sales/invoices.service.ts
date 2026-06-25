import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';
import { KafkaProducerService } from '../kafka/kafka.producer.service';

class InvoiceLineDto {
  @IsOptional() @IsUUID() soLineId?: string;
  @IsUUID() productId: string;
  @IsUUID() uomId: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() discountPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number;
}

export class CreateInvoiceDto {
  @IsUUID() soId: string;
  @IsUUID() customerId: string;
  @IsDateString() invoiceDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto) lines: InvoiceLineDto[];
}

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private kafka: KafkaProducerService,
  ) {}

  async findAll(query: PaginationDto & { customerId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.search) where.invoiceNumber = { contains: query.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, take, skip,
        include: {
          customer: { select: { code: true, name: true } },
          so: { select: { soNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        so: { select: { id: true, soNumber: true } },
        lines: { include: { product: { select: { id: true, sku: true, name: true } }, uom: true } },
        accountsReceivable: true,
      },
    });
    if (!inv) throw new NotFoundException('Hóa đơn không tồn tại');
    return inv;
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    const daysToAdd = customer?.paymentTermDays ?? 30;
    const dueDate = new Date(dto.invoiceDate);
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    const lines = dto.lines.map((l) => {
      const discount = l.discountPct ?? 0;
      const tax = l.taxRate ?? 0;
      const subtotal = l.quantity * l.unitPrice * (1 - discount / 100);
      return { ...l, discountPct: discount, taxRate: tax, subtotal };
    });

    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = lines.reduce((s, l) => s + l.subtotal * (l.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        soId: dto.soId,
        customerId: dto.customerId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate,
        notes: dto.notes,
        subtotal,
        taxAmount,
        grandTotal,
        createdBy: userId,
        lines: {
          create: lines.map((l) => ({
            soLineId: l.soLineId,
            productId: l.productId,
            uomId: l.uomId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            taxRate: l.taxRate,
            subtotal: l.subtotal,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async confirm(id: string, userId: string) {
    const inv = await this.findOne(id);
    if (inv.status !== InvoiceStatus.DRAFT) throw new BadRequestException('Hóa đơn không ở trạng thái DRAFT');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.accountsReceivable.create({
        data: {
          invoiceId: inv.id,
          customerId: inv.customerId,
          amountTotal: inv.grandTotal,
          amountPaid: 0,
          amountRemaining: inv.grandTotal,
          dueDate: inv.dueDate,
          status: PaymentStatus.PENDING,
        },
      });

      return tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.CONFIRMED },
      });
    });

    this.kafka.emitInvoiceConfirmed({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      soId: inv.soId,
      customerId: inv.customerId,
      grandTotal: Number(inv.grandTotal),
      dueDate: inv.dueDate.toISOString(),
      traceUserId: userId,
    });

    return result;
  }

  async cancel(id: string) {
    const inv = await this.findOne(id);
    const hasPayment = inv.accountsReceivable.some((ar) => Number(ar.amountPaid) > 0);
    if (inv.status === InvoiceStatus.CONFIRMED && hasPayment) {
      throw new BadRequestException('Không thể hủy hóa đơn đã có thanh toán');
    }

    return this.prisma.$transaction(async (tx) => {
      if (inv.accountsReceivable.length > 0) {
        await tx.accountsReceivable.deleteMany({ where: { invoiceId: inv.id } });
      }
      return tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED } });
    });
  }
}
