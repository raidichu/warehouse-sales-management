import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IsArray, IsBoolean, IsDecimal, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

export class CreateProductDto {
  @IsString() sku: string;
  @IsString() name: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsUUID() baseUomId: string;
  @IsOptional() @IsUUID() saleUomId?: string;
  @IsOptional() @IsUUID() purchaseUomId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() salePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() purchasePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() taxRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minStockQty?: number;
}

export class CreateCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateUomDto {
  @IsString() name: string;
  @IsString() symbol: string;
  @IsOptional() @IsString() description?: string;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Products
  async findAll(query: PaginationDto & { categoryId?: string; status?: string }) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        take,
        skip,
        include: {
          category: { select: { id: true, name: true } },
          baseUom: { select: { id: true, name: true, symbol: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        baseUom: true,
        saleUom: true,
        purchaseUom: true,
      },
    });
    if (!p) throw new NotFoundException('Sản phẩm không tồn tại');
    return p;
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        categoryId: dto.categoryId,
        baseUomId: dto.baseUomId,
        saleUomId: dto.saleUomId,
        purchaseUomId: dto.purchaseUomId,
        description: dto.description,
        salePrice: dto.salePrice ?? 0,
        purchasePrice: dto.purchasePrice ?? 0,
        taxRate: dto.taxRate ?? 0,
        minStockQty: dto.minStockQty ?? 0,
      },
      include: { category: true, baseUom: true },
    });
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto as any });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { status: 'inactive' } });
  }

  // Categories
  findAllCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      include: { parent: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.productCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>) {
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  // UoM
  findAllUoms() {
    return this.prisma.unitOfMeasure.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createUom(dto: CreateUomDto) {
    return this.prisma.unitOfMeasure.create({ data: dto });
  }
}
