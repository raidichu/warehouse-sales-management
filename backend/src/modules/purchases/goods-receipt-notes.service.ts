import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus, POStatus, PaymentStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';
import { KafkaProducerService } from '../kafka/kafka.producer.service';

class GRNLineDto {
  @IsOptional() @IsUUID() poLineId?: string;
  @IsUUID() productId: string;
  @IsUUID() uomId: string;
  @IsOptional() @IsUUID() locationId?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) qtyReceived: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number;
}

export class CreateGRNDto {
  @IsOptional() @IsUUID() poId?: string;
  @IsUUID() supplierId: string;
  @IsUUID() warehouseId: string;
  @IsDateString() receiptDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => GRNLineDto) lines: GRNLineDto[];
}

@Injectable()
export class GoodsReceiptNotesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private kafka: KafkaProducerService,
  ) {}

  async findAll(query: PaginationDto & { supplierId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.goodsReceiptNote.findMany({
        where, take, skip,
        include: {
          supplier: { select: { code: true, name: true } },
          warehouse: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goodsReceiptNote.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const grn = await this.prisma.goodsReceiptNote.findUnique({
      where: { id },
      include: {
        po: { select: { id: true, poNumber: true } },
        supplier: true,
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            uom: { select: { symbol: true } },
            location: { select: { code: true, name: true } },
          },
        },
        accountsPayable: true,
      },
    });
    if (!grn) throw new NotFoundException('Phiếu nhập hàng không tồn tại');
    return grn;
  }

  async create(dto: CreateGRNDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.goodsReceiptNote.count({ where: { grnNumber: { startsWith: `GRN-${year}-` } } });
    const grnNumber = `GRN-${year}-${String(count + 1).padStart(5, '0')}`;

    const lines = dto.lines.map((l) => {
      const tax = l.taxRate ?? 0;
      return { ...l, taxRate: tax, subtotal: l.qtyReceived * l.unitPrice, unitCost: l.unitPrice };
    });

    const subtotal = lines.reduce((s, l) => s + l.qtyReceived * l.unitPrice, 0);
    const taxAmount = lines.reduce((s, l) => s + l.qtyReceived * l.unitPrice * (l.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount;

    return this.prisma.goodsReceiptNote.create({
      data: {
        grnNumber,
        poId: dto.poId,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        receiptDate: new Date(dto.receiptDate),
        notes: dto.notes,
        subtotal,
        taxAmount,
        grandTotal,
        createdBy: userId,
        lines: {
          create: lines.map((l) => ({
            poLineId: l.poLineId,
            productId: l.productId,
            uomId: l.uomId,
            locationId: l.locationId,
            qtyReceived: l.qtyReceived,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            subtotal: l.subtotal,
            unitCost: l.unitCost,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async confirm(id: string, userId: string) {
    const grn = await this.findOne(id);
    if (grn.status !== DocumentStatus.DRAFT) throw new BadRequestException('Phiếu không ở trạng thái DRAFT');

    // Get supplier payment term
    const supplier = await this.prisma.supplier.findUnique({ where: { id: grn.supplierId } });
    const daysToAdd = supplier?.paymentTermDays ?? 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    const result = await this.prisma.$transaction(async (tx) => {
      // Update inventory for each line
      for (const line of grn.lines) {
        await this.inventoryService.upsertInventory(tx, {
          productId: line.productId,
          warehouseId: grn.warehouseId,
          locationId: line.locationId,
          quantityDelta: Number(line.qtyReceived),
          newUnitCost: Number(line.unitCost),
        });

        await tx.stockTransaction.create({
          data: {
            type: 'PURCHASE_RECEIPT',
            productId: line.productId,
            warehouseId: grn.warehouseId,
            locationId: line.locationId,
            quantity: line.qtyReceived,
            unitCost: line.unitCost,
            refType: 'GoodsReceiptNote',
            refId: grn.id,
            refNumber: grn.grnNumber,
            createdBy: userId,
          },
        });

        // Update PO line received qty
        if (line.poLineId) {
          await tx.purchaseOrderLine.update({
            where: { id: line.poLineId },
            data: { receivedQty: { increment: Number(line.qtyReceived) } },
          });
        }
      }

      // Update PO status if all lines received
      if (grn.poId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: grn.poId },
          include: { lines: true },
        });
        const allReceived = po.lines.every((l) => Number(l.receivedQty) >= Number(l.quantity));
        const anyReceived = po.lines.some((l) => Number(l.receivedQty) > 0);
        await tx.purchaseOrder.update({
          where: { id: grn.poId },
          data: { status: allReceived ? POStatus.RECEIVED : anyReceived ? POStatus.PARTIALLY_RECEIVED : undefined },
        });
      }

      // Create AP record
      await tx.accountsPayable.create({
        data: {
          grnId: grn.id,
          supplierId: grn.supplierId,
          amountTotal: grn.grandTotal,
          amountPaid: 0,
          amountRemaining: grn.grandTotal,
          dueDate,
          status: PaymentStatus.PENDING,
        },
      });

      const confirmed = await tx.goodsReceiptNote.update({
        where: { id },
        data: { status: DocumentStatus.CONFIRMED, confirmedBy: userId, confirmedAt: new Date() },
      });
      return confirmed;
    });

    this.kafka.emitGrnConfirmed({
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      supplierId: grn.supplierId,
      warehouseId: grn.warehouseId,
      grandTotal: Number(grn.grandTotal),
      lines: grn.lines.map((l) => ({
        productId: l.productId,
        locationId: l.locationId,
        qtyReceived: Number(l.qtyReceived),
        unitCost: Number(l.unitCost),
      })),
      traceUserId: userId,
    });

    return result;
  }
}
