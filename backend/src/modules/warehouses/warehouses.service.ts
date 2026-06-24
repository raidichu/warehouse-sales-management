import { Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateWarehouseDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() address?: string;
}

export class CreateLocationDto {
  @IsString() code: string;
  @IsString() name: string;
}

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      include: { locations: { where: { isActive: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const w = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { locations: { where: { isActive: true } } },
    });
    if (!w) throw new NotFoundException('Kho không tồn tại');
    return w;
  }

  async create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateWarehouseDto>) {
    await this.findOne(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async addLocation(warehouseId: string, dto: CreateLocationDto) {
    await this.findOne(warehouseId);
    return this.prisma.stockLocation.create({ data: { warehouseId, ...dto } });
  }

  async updateLocation(id: string, dto: Partial<CreateLocationDto>) {
    return this.prisma.stockLocation.update({ where: { id }, data: dto });
  }

  async getInventory(warehouseId: string) {
    await this.findOne(warehouseId);
    return this.prisma.inventory.findMany({
      where: { warehouseId, quantity: { gt: 0 } },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }
}
