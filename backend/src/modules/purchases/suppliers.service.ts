import { Injectable, NotFoundException } from '@nestjs/common';
import { IsEmail, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

export class CreateSupplierDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() taxCode?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) paymentTermDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) creditLimit?: number;
}

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { taxCode: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where, take, skip,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchaseOrders: true, goodsReceiptNotes: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Nhà cung cấp không tồn tại');
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateSupplierDto>) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }
}
