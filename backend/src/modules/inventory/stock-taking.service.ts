import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StockTakingStatus } from '@prisma/client';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

export class CreateStockTakingDto {
  @IsUUID() warehouseId: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateActualQtyDto {
  @IsUUID() lineId: string;
  actualQty: number;
  @IsOptional() @IsString() note?: string;
}

@Injectable()
export class StockTakingService {
  constructor(private prisma: PrismaService, private inventoryService: InventoryService) {}

  async findAll(query: PaginationDto) {
    const { take, skip } = paginate(query.page, query.limit);
    const [data, total] = await Promise.all([
      this.prisma.stockTakingSession.findMany({
        take, skip,
        include: {
          warehouse: { select: { code: true, name: true } },
          creator: { select: { fullName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.stockTakingSession.count(),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const s = await this.prisma.stockTakingSession.findUnique({
      where: { id },
      include: {
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            location: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Phiên kiểm kê không tồn tại');
    return s;
  }

  // Creates session and loads system quantities from current inventory
  async create(dto: CreateStockTakingDto, userId: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: { warehouseId: dto.warehouseId },
    });

    return this.prisma.stockTakingSession.create({
      data: {
        warehouseId: dto.warehouseId,
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: inventory.map((inv) => ({
            productId: inv.productId,
            locationId: inv.locationId,
            systemQty: inv.quantity,
            actualQty: 0,
            difference: 0,
          })),
        },
      },
      include: { lines: { include: { product: { select: { sku: true, name: true } } } } },
    });
  }

  async updateActualQty(sessionId: string, lineId: string, actualQty: number, note?: string) {
    const session = await this.prisma.stockTakingSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== StockTakingStatus.IN_PROGRESS) {
      throw new BadRequestException('Phiên kiểm kê không ở trạng thái IN_PROGRESS');
    }

    const line = await this.prisma.stockTakingLine.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Dòng kiểm kê không tồn tại');

    return this.prisma.stockTakingLine.update({
      where: { id: lineId },
      data: { actualQty, difference: actualQty - Number(line.systemQty), note },
    });
  }

  async complete(sessionId: string, userId: string) {
    const session = await this.findOne(sessionId);
    if (session.status !== StockTakingStatus.IN_PROGRESS) {
      throw new BadRequestException('Phiên kiểm kê không ở trạng thái IN_PROGRESS');
    }

    return this.prisma.$transaction(async (tx) => {
      // Apply inventory adjustments for lines with differences
      for (const line of session.lines) {
        if (Number(line.difference) !== 0) {
          const type = Number(line.difference) > 0 ? 'ADJUSTMENT_POSITIVE' : 'ADJUSTMENT_NEGATIVE';

          await this.inventoryService.upsertInventory(tx, {
            productId: line.productId,
            warehouseId: session.warehouseId,
            locationId: line.locationId,
            quantityDelta: Number(line.difference),
          });

          await tx.stockTransaction.create({
            data: {
              type: type as any,
              productId: line.productId,
              warehouseId: session.warehouseId,
              locationId: line.locationId,
              quantity: line.difference,
              refType: 'StockTaking',
              refId: session.id,
              note: `Điều chỉnh kiểm kê: ${line.note ?? ''}`,
              createdBy: userId,
            },
          });

          await tx.stockTakingLine.update({ where: { id: line.id }, data: { isAdjusted: true } });
        }
      }

      return tx.stockTakingSession.update({
        where: { id: sessionId },
        data: { status: StockTakingStatus.COMPLETED, completedAt: new Date() },
      });
    });
  }
}
