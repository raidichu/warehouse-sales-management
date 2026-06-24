import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { POStatus } from '@prisma/client';
import {
  IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

class POLineDto {
  @IsUUID() productId: string;
  @IsUUID() uomId: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number;
}

export class CreatePODto {
  @IsUUID() supplierId: string;
  @IsDateString() orderDate: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => POLineDto) lines: POLineDto[];
}

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { supplierId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    if (query.search) where.poNumber = { contains: query.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where, take, skip,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          creator: { select: { fullName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        creator: { select: { id: true, fullName: true } },
        approver: { select: { id: true, fullName: true } },
        lines: { include: { product: { select: { id: true, sku: true, name: true } }, uom: true } },
        grnList: { select: { id: true, grnNumber: true, status: true, receiptDate: true } },
      },
    });
    if (!po) throw new NotFoundException('Đơn mua hàng không tồn tại');
    return po;
  }

  async create(dto: CreatePODto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.purchaseOrder.count({ where: { poNumber: { startsWith: `PO-${year}-` } } });
    const poNumber = `PO-${year}-${String(count + 1).padStart(5, '0')}`;

    const lines = dto.lines.map((l) => {
      const tax = l.taxRate ?? 0;
      const subtotal = l.quantity * l.unitPrice * (1 + tax / 100);
      return { ...l, subtotal, taxRate: tax };
    });

    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const taxAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount;

    return this.prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: dto.supplierId,
        orderDate: new Date(dto.orderDate),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
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
            taxRate: l.taxRate,
            subtotal: l.quantity * l.unitPrice,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async submit(id: string) {
    const po = await this.findOne(id);
    if (po.status !== POStatus.DRAFT) throw new BadRequestException('Chỉ có thể nộp đơn ở trạng thái DRAFT');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: POStatus.SUBMITTED } });
  }

  async approve(id: string, userId: string) {
    const po = await this.findOne(id);
    if (po.status !== POStatus.SUBMITTED) throw new BadRequestException('Đơn chưa được nộp');
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.APPROVED, approvedBy: userId, approvedAt: new Date() },
    });
  }

  async cancel(id: string) {
    const po = await this.findOne(id);
    if (!['DRAFT', 'SUBMITTED'].includes(po.status)) throw new BadRequestException('Không thể hủy đơn đã duyệt hoặc đã nhận');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: POStatus.CANCELLED } });
  }
}
