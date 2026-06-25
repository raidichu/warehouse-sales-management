import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SOStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';
import { KafkaProducerService } from '../kafka/kafka.producer.service';

class SOLineDto {
  @IsUUID() productId: string;
  @IsUUID() uomId: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() discountPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number;
}

export class CreateSODto {
  @IsOptional() @IsUUID() quotationId?: string;
  @IsUUID() customerId: string;
  @IsUUID() warehouseId: string;
  @IsDateString() orderDate: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SOLineDto) lines: SOLineDto[];
}

@Injectable()
export class SalesOrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private kafka: KafkaProducerService,
  ) {}

  async findAll(query: PaginationDto & { customerId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.search) where.soNumber = { contains: query.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where, take, skip,
        include: {
          customer: { select: { code: true, name: true } },
          warehouse: { select: { code: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        quotation: { select: { id: true, quotationNumber: true } },
        lines: { include: { product: { select: { id: true, sku: true, name: true } }, uom: true } },
        gdnList: { select: { id: true, gdnNumber: true, status: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true } },
      },
    });
    if (!so) throw new NotFoundException('Đơn bán hàng không tồn tại');
    return so;
  }

  async create(dto: CreateSODto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.salesOrder.count({ where: { soNumber: { startsWith: `SO-${year}-` } } });
    const soNumber = `SO-${year}-${String(count + 1).padStart(5, '0')}`;

    const lines = dto.lines.map((l) => {
      const discount = l.discountPct ?? 0;
      const tax = l.taxRate ?? 0;
      const subtotal = l.quantity * l.unitPrice * (1 - discount / 100);
      return { ...l, discountPct: discount, taxRate: tax, subtotal };
    });

    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const taxAmount = lines.reduce((s, l) => s + l.subtotal * (l.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount;

    return this.prisma.salesOrder.create({
      data: {
        soNumber,
        quotationId: dto.quotationId,
        customerId: dto.customerId,
        warehouseId: dto.warehouseId,
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
            discountPct: l.discountPct,
            taxRate: l.taxRate,
            subtotal: l.subtotal,
            deliveredQty: 0,
          })),
        },
      },
      include: { lines: true },
    });
  }

  // Confirm SO → reserve inventory for each line
  async confirm(id: string, userId: string) {
    const so = await this.findOne(id);
    if (so.status !== SOStatus.DRAFT) throw new BadRequestException('Đơn hàng không ở trạng thái DRAFT');

    const result = await this.prisma.$transaction(async (tx) => {
      for (const line of so.lines) {
        await this.inventoryService.reserveInventory(
          tx,
          line.productId,
          so.warehouseId,
          Number(line.quantity),
        );
      }
      return tx.salesOrder.update({
        where: { id },
        data: { status: SOStatus.CONFIRMED },
      });
    });

    this.kafka.emitSoConfirmed({
      soId: so.id,
      soNumber: so.soNumber,
      customerId: so.customerId,
      warehouseId: so.warehouseId,
      grandTotal: Number(so.grandTotal),
      lines: so.lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
      })),
      traceUserId: userId,
    });

    return result;
  }

  async cancel(id: string, userId: string) {
    const so = await this.findOne(id);
    if (!([SOStatus.DRAFT, SOStatus.CONFIRMED] as string[]).includes(so.status)) {
      throw new BadRequestException('Không thể hủy đơn hàng ở trạng thái này');
    }

    return this.prisma.$transaction(async (tx) => {
      if (so.status === SOStatus.CONFIRMED) {
        for (const line of so.lines) {
          await this.inventoryService.releaseReservation(
            tx,
            line.productId,
            so.warehouseId,
            Number(line.quantity),
          );
        }
      }
      return tx.salesOrder.update({ where: { id }, data: { status: SOStatus.CANCELLED } });
    });
  }
}
