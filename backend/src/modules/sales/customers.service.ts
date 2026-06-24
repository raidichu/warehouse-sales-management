import { Injectable, NotFoundException } from '@nestjs/common';
import { IsEmail, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';

export class CreateCustomerDto {
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
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const { take, skip } = paginate(query.page, query.limit);
    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where, take, skip,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { salesOrders: true, invoices: true } },
      },
    });
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateCustomerDto>) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }
}
