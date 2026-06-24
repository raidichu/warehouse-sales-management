import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

class QuotationLineDto {
  @IsUUID() productId: string;
  @IsUUID() uomId: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() discountPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number;
}

export class CreateQuotationDto {
  @IsUUID() customerId: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuotationLineDto) lines: QuotationLineDto[];
}

@Injectable()
export class QuotationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { customerId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.search) where.quotationNumber = { contains: query.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where, take, skip,
        include: {
          customer: { select: { code: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { include: { product: { select: { id: true, sku: true, name: true } }, uom: true } },
      },
    });
    if (!q) throw new NotFoundException('Báo giá không tồn tại');
    return q;
  }

  async create(dto: CreateQuotationDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.quotation.count({ where: { quotationNumber: { startsWith: `QT-${year}-` } } });
    const quotationNumber = `QT-${year}-${String(count + 1).padStart(5, '0')}`;

    const lines = dto.lines.map((l) => {
      const discount = l.discountPct ?? 0;
      const tax = l.taxRate ?? 0;
      const subtotal = l.quantity * l.unitPrice * (1 - discount / 100);
      return { ...l, discountPct: discount, taxRate: tax, subtotal };
    });

    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = lines.reduce((s, l) => s + l.subtotal * (l.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount;

    return this.prisma.quotation.create({
      data: {
        quotationNumber,
        customerId: dto.customerId,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        notes: dto.notes,
        subtotal,
        taxAmount,
        grandTotal,
        createdBy: userId,
        lines: {
          create: lines.map((l) => ({
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

  async send(id: string) {
    const q = await this.findOne(id);
    if (q.status !== QuotationStatus.DRAFT) throw new BadRequestException('Báo giá không ở trạng thái DRAFT');
    return this.prisma.quotation.update({ where: { id }, data: { status: QuotationStatus.SENT } });
  }

  async accept(id: string) {
    const q = await this.findOne(id);
    if (q.status !== QuotationStatus.SENT) throw new BadRequestException('Báo giá chưa được gửi');
    return this.prisma.quotation.update({ where: { id }, data: { status: QuotationStatus.ACCEPTED } });
  }

  async reject(id: string) {
    const q = await this.findOne(id);
    if (!([QuotationStatus.DRAFT, QuotationStatus.SENT] as string[]).includes(q.status)) {
      throw new BadRequestException('Không thể từ chối báo giá ở trạng thái này');
    }
    return this.prisma.quotation.update({ where: { id }, data: { status: QuotationStatus.REJECTED } });
  }
}
