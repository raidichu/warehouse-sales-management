import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

class IssueLineDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() locationId?: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity: number;
  @IsOptional() @IsString() note?: string;
}

export class CreateStockIssueDto {
  @IsUUID() warehouseId: string;
  @IsDateString() issueDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => IssueLineDto) lines: IssueLineDto[];
}

@Injectable()
export class StockIssuesService {
  constructor(private prisma: PrismaService, private inventoryService: InventoryService) {}

  async findAll(query: PaginationDto & { warehouseId?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    const [data, total] = await Promise.all([
      this.prisma.stockIssue.findMany({
        where, take, skip,
        include: { warehouse: { select: { code: true, name: true } }, creator: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockIssue.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const r = await this.prisma.stockIssue.findUnique({
      where: { id },
      include: {
        warehouse: true,
        lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
      },
    });
    if (!r) throw new NotFoundException('Phiếu xuất kho không tồn tại');
    return r;
  }

  async create(dto: CreateStockIssueDto, userId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.stockIssue.count({ where: { issueNumber: { startsWith: `XK-${year}-` } } });
    const issueNumber = `XK-${year}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.stockIssue.create({
      data: {
        issueNumber,
        warehouseId: dto.warehouseId,
        issueDate: new Date(dto.issueDate),
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            locationId: l.locationId,
            quantity: l.quantity,
            note: l.note,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async confirm(id: string, userId: string) {
    const issue = await this.findOne(id);
    if (issue.status !== DocumentStatus.DRAFT) throw new BadRequestException('Phiếu không ở trạng thái DRAFT');

    return this.prisma.$transaction(async (tx) => {
      for (const line of issue.lines) {
        await this.inventoryService.upsertInventory(tx, {
          productId: line.productId,
          warehouseId: issue.warehouseId,
          locationId: line.locationId,
          quantityDelta: -Number(line.quantity),
        });

        await tx.stockTransaction.create({
          data: {
            type: 'INTERNAL_ISSUE',
            productId: line.productId,
            warehouseId: issue.warehouseId,
            locationId: line.locationId,
            quantity: new (require('@prisma/client/runtime/library').Decimal)(line.quantity).negated(),
            refType: 'StockIssue',
            refId: issue.id,
            refNumber: issue.issueNumber,
            note: line.note,
            createdBy: userId,
          },
        });
      }

      return tx.stockIssue.update({
        where: { id },
        data: { status: DocumentStatus.CONFIRMED, confirmedBy: userId, confirmedAt: new Date() },
      });
    });
  }
}
