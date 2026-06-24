import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus, SOStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

class GDNLineDto {
  @IsUUID() soLineId: string;
  @IsUUID() productId: string;
  @IsUUID() uomId: string;
  @IsOptional() @IsUUID() locationId?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) qtyDelivered: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitCost?: number;
}

export class CreateGDNDto {
  @IsUUID() soId: string;
  @IsUUID() warehouseId: string;
  @IsDateString() deliveryDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => GDNLineDto) lines: GDNLineDto[];
}

@Injectable()
export class GoodsDeliveryNotesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  async findAll(query: PaginationDto & { soId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.soId) where.soId = query.soId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.goodsDeliveryNote.findMany({
        where, take, skip,
        include: {
          so: { select: { soNumber: true, customerId: true, customer: { select: { code: true, name: true } } } },
          warehouse: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goodsDeliveryNote.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const gdn = await this.prisma.goodsDeliveryNote.findUnique({
      where: { id },
      include: {
        so: { select: { id: true, soNumber: true, customerId: true } },
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            uom: { select: { symbol: true } },
            location: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!gdn) throw new NotFoundException('Phiếu xuất kho không tồn tại');
    return gdn;
  }

  async create(dto: CreateGDNDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.goodsDeliveryNote.count({ where: { gdnNumber: { startsWith: `GDN-${year}-` } } });
    const gdnNumber = `GDN-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.goodsDeliveryNote.create({
      data: {
        gdnNumber,
        soId: dto.soId,
        warehouseId: dto.warehouseId,
        deliveryDate: new Date(dto.deliveryDate),
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: dto.lines.map((l) => ({
            soLineId: l.soLineId,
            productId: l.productId,
            uomId: l.uomId,
            locationId: l.locationId,
            qtyDelivered: l.qtyDelivered,
            unitCost: l.unitCost ?? 0,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async confirm(id: string, userId: string) {
    const gdn = await this.findOne(id);
    if (gdn.status !== DocumentStatus.DRAFT) throw new BadRequestException('Phiếu không ở trạng thái DRAFT');

    return this.prisma.$transaction(async (tx) => {
      for (const line of gdn.lines) {
        await this.inventoryService.upsertInventory(tx, {
          productId: line.productId,
          warehouseId: gdn.warehouseId,
          locationId: line.locationId,
          quantityDelta: -Number(line.qtyDelivered),
        });

        await this.inventoryService.releaseReservation(
          tx,
          line.productId,
          gdn.warehouseId,
          Number(line.qtyDelivered),
          line.locationId,
        );

        await tx.stockTransaction.create({
          data: {
            type: 'SALE_DELIVERY',
            productId: line.productId,
            warehouseId: gdn.warehouseId,
            locationId: line.locationId,
            quantity: line.qtyDelivered,
            unitCost: line.unitCost,
            refType: 'GoodsDeliveryNote',
            refId: gdn.id,
            refNumber: gdn.gdnNumber,
            createdBy: userId,
          },
        });

        await tx.salesOrderLine.update({
          where: { id: line.soLineId },
          data: { deliveredQty: { increment: Number(line.qtyDelivered) } },
        });
      }

      const so = await tx.salesOrder.findUnique({
        where: { id: gdn.soId },
        include: { lines: true },
      });
      const allDelivered = so.lines.every((l) => Number(l.deliveredQty) >= Number(l.quantity));
      const anyDelivered = so.lines.some((l) => Number(l.deliveredQty) > 0);
      await tx.salesOrder.update({
        where: { id: gdn.soId },
        data: {
          status: allDelivered
            ? SOStatus.DELIVERED
            : anyDelivered
              ? SOStatus.PARTIALLY_DELIVERED
              : undefined,
        },
      });

      return tx.goodsDeliveryNote.update({
        where: { id },
        data: { status: DocumentStatus.CONFIRMED, confirmedBy: userId, confirmedAt: new Date() },
      });
    });
  }
}
