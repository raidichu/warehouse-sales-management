import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

class ReceiptLineDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() locationId?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() note?: string;
}

export class CreateStockReceiptDto {
  @IsUUID() warehouseId: string;
  @IsDateString() receiptDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiptLineDto) lines: ReceiptLineDto[];
}

@Injectable()
export class StockReceiptsService {
  constructor(private prisma: PrismaService, private inventoryService: InventoryService) {}

  async findAll(query: PaginationDto & { warehouseId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.search) where.receiptNumber = { contains: query.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.stockReceipt.findMany({
        where, take, skip,
        include: { warehouse: { select: { code: true, name: true } }, creator: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockReceipt.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const r = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: {
        warehouse: true,
        creator: { select: { id: true, fullName: true } },
        confirmer: { select: { id: true, fullName: true } },
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
      },
    });
    if (!r) throw new NotFoundException('Phiếu nhập kho không tồn tại');
    return r;
  }

  async create(dto: CreateStockReceiptDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.stockReceipt.count({
      where: { receiptNumber: { startsWith: `NK-${year}-` } },
    });
    const receiptNumber = `NK-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.stockReceipt.create({
      data: {
        receiptNumber,
        warehouseId: dto.warehouseId,
        receiptDate: new Date(dto.receiptDate),
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            locationId: l.locationId,
            quantity: l.quantity,
            unitCost: l.unitCost ?? 0,
            note: l.note,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async confirm(id: string, userId: string) {
    const receipt = await this.findOne(id);
    if (receipt.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể xác nhận phiếu ở trạng thái DRAFT');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update inventory for each line
      for (const line of receipt.lines) {
        await this.inventoryService.upsertInventory(tx, {
          productId: line.productId,
          warehouseId: receipt.warehouseId,
          locationId: line.locationId,
          quantityDelta: Number(line.quantity),
          newUnitCost: Number(line.unitCost),
        });

        await tx.stockTransaction.create({
          data: {
            type: 'INTERNAL_RECEIPT',
            productId: line.productId,
            warehouseId: receipt.warehouseId,
            locationId: line.locationId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            refType: 'StockReceipt',
            refId: receipt.id,
            refNumber: receipt.receiptNumber,
            note: line.note,
            createdBy: userId,
          },
        });
      }

      return tx.stockReceipt.update({
        where: { id },
        data: { status: DocumentStatus.CONFIRMED, confirmedBy: userId, confirmedAt: new Date() },
      });
    });
  }

  async cancel(id: string) {
    const receipt = await this.findOne(id);
    if (receipt.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể hủy phiếu ở trạng thái DRAFT');
    }
    return this.prisma.stockReceipt.update({ where: { id }, data: { status: DocumentStatus.CANCELLED } });
  }
}
