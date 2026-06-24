import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

export interface InventoryUpdateInput {
  productId: string;
  warehouseId: string;
  locationId?: string;
  quantityDelta: number;   // positive = in, negative = out
  newUnitCost?: number;    // for receipts (weighted average cost calc)
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { warehouseId?: string; belowMin?: boolean }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.search) {
      where.product = { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { sku: { contains: query.search, mode: 'insensitive' } }] };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        take,
        skip,
        include: {
          product: { select: { id: true, sku: true, name: true, minStockQty: true, baseUom: { select: { symbol: true } } } },
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
        },
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    let data = items.map((i) => ({
      ...i,
      availableQty: Number(i.quantity) - Number(i.reservedQty),
      stockValue: Number(i.quantity) * Number(i.avgCost),
      isBelowMin: Number(i.quantity) < Number(i.product.minStockQty),
    }));

    if (query.belowMin) data = data.filter((d) => d.isBelowMin);

    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async getTransactions(query: PaginationDto & { warehouseId?: string; productId?: string; type?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        take,
        skip,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  // Core inventory update — called inside transactions by other services
  async upsertInventory(
    tx: any,
    input: InventoryUpdateInput,
  ): Promise<void> {
    const key = {
      productId_warehouseId_locationId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        locationId: input.locationId ?? null,
      },
    };

    const existing = await tx.inventory.findUnique({ where: key });

    if (!existing) {
      await tx.inventory.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          locationId: input.locationId,
          quantity: Math.max(0, input.quantityDelta),
          avgCost: input.newUnitCost ?? 0,
        },
      });
      return;
    }

    const currentQty = Number(existing.quantity);
    const currentAvgCost = Number(existing.avgCost);
    let newAvgCost = currentAvgCost;

    // Weighted average cost (only recalculate on inbound)
    if (input.quantityDelta > 0 && input.newUnitCost !== undefined) {
      const totalCurrentValue = currentQty * currentAvgCost;
      const totalNewValue = input.quantityDelta * input.newUnitCost;
      const totalQty = currentQty + input.quantityDelta;
      newAvgCost = totalQty > 0 ? (totalCurrentValue + totalNewValue) / totalQty : input.newUnitCost;
    }

    const newQty = currentQty + input.quantityDelta;
    if (newQty < 0) throw new BadRequestException(`Tồn kho không đủ cho sản phẩm ${input.productId}`);

    await tx.inventory.update({
      where: key,
      data: { quantity: newQty, avgCost: newAvgCost },
    });
  }

  async reserveInventory(
    tx: any,
    productId: string,
    warehouseId: string,
    qty: number,
    locationId?: string,
  ): Promise<void> {
    const inv = await tx.inventory.findUnique({
      where: { productId_warehouseId_locationId: { productId, warehouseId, locationId: locationId ?? null } },
    });

    const available = inv ? Number(inv.quantity) - Number(inv.reservedQty) : 0;
    if (available < qty) throw new BadRequestException('Tồn kho không đủ để đặt hàng');

    await tx.inventory.update({
      where: { productId_warehouseId_locationId: { productId, warehouseId, locationId: locationId ?? null } },
      data: { reservedQty: { increment: qty } },
    });
  }

  async releaseReservation(
    tx: any,
    productId: string,
    warehouseId: string,
    qty: number,
    locationId?: string,
  ): Promise<void> {
    await tx.inventory.update({
      where: { productId_warehouseId_locationId: { productId, warehouseId, locationId: locationId ?? null } },
      data: { reservedQty: { decrement: qty } },
    });
  }

  async generateDocNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;
    const result = await this.prisma.$queryRaw<{ max: number }[]>`
      SELECT COALESCE(MAX(CAST(SPLIT_PART(receipt_number, '-', 3) AS INTEGER)), 0) as max
      FROM stock_receipts
      WHERE receipt_number LIKE ${pattern}
    `;
    const seq = (result[0]?.max ?? 0) + 1;
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }
}
