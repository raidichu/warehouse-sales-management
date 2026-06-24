import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

class TransferLineDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() fromLocationId?: string;
  @IsOptional() @IsUUID() toLocationId?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @IsOptional() @IsString() note?: string;
}

export class CreateStockTransferDto {
  @IsUUID() fromWarehouseId: string;
  @IsUUID() toWarehouseId: string;
  @IsDateString() transferDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TransferLineDto) lines: TransferLineDto[];
}

@Injectable()
export class StockTransfersService {
  constructor(private prisma: PrismaService, private inventoryService: InventoryService) {}

  async findAll(query: PaginationDto) {
    const { take, skip } = paginate(query.page, query.limit);
    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        take, skip,
        include: {
          fromWarehouse: { select: { code: true, name: true } },
          toWarehouse: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockTransfer.count(),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const t = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: true, toWarehouse: true,
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Phiếu chuyển kho không tồn tại');
    return t;
  }

  async create(dto: CreateStockTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) throw new BadRequestException('Kho nguồn và kho đích phải khác nhau');
    const year = new Date().getFullYear();
    const count = await this.prisma.stockTransfer.count({ where: { transferNumber: { startsWith: `CK-${year}-` } } });
    const transferNumber = `CK-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        transferDate: new Date(dto.transferDate),
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            fromLocationId: l.fromLocationId,
            toLocationId: l.toLocationId,
            quantity: l.quantity,
            note: l.note,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async confirm(id: string, userId: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== DocumentStatus.DRAFT) throw new BadRequestException('Phiếu không ở trạng thái DRAFT');

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        // Get avg cost from source warehouse
        const srcInv = await tx.inventory.findUnique({
          where: {
            productId_warehouseId_locationId: {
              productId: line.productId,
              warehouseId: transfer.fromWarehouseId,
              locationId: line.fromLocationId ?? null,
            },
          },
        });
        const avgCost = srcInv ? Number(srcInv.avgCost) : 0;

        // Deduct from source
        await this.inventoryService.upsertInventory(tx, {
          productId: line.productId,
          warehouseId: transfer.fromWarehouseId,
          locationId: line.fromLocationId,
          quantityDelta: -Number(line.quantity),
        });

        // Add to destination with same avg cost
        await this.inventoryService.upsertInventory(tx, {
          productId: line.productId,
          warehouseId: transfer.toWarehouseId,
          locationId: line.toLocationId,
          quantityDelta: Number(line.quantity),
          newUnitCost: avgCost,
        });

        const qty = Number(line.quantity);
        await tx.stockTransaction.createMany({
          data: [
            {
              type: 'TRANSFER_OUT',
              productId: line.productId,
              warehouseId: transfer.fromWarehouseId,
              locationId: line.fromLocationId,
              quantity: -qty,
              unitCost: avgCost,
              refType: 'StockTransfer',
              refId: transfer.id,
              refNumber: transfer.transferNumber,
              createdBy: userId,
            },
            {
              type: 'TRANSFER_IN',
              productId: line.productId,
              warehouseId: transfer.toWarehouseId,
              locationId: line.toLocationId,
              quantity: qty,
              unitCost: avgCost,
              refType: 'StockTransfer',
              refId: transfer.id,
              refNumber: transfer.transferNumber,
              createdBy: userId,
            },
          ],
        });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: DocumentStatus.CONFIRMED, confirmedBy: userId, confirmedAt: new Date() },
      });
    });
  }
}
