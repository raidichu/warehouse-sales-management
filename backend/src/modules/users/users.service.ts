import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationDto, paginate, paginateMeta } from '../../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const { take, skip } = paginate(query.page, query.limit);
    const where = query.search
      ? { OR: [{ fullName: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take,
        skip,
        select: {
          id: true, email: true, fullName: true, isActive: true, createdAt: true,
          userRoles: { select: { role: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: paginateMeta(total, query.page, query.limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email đã được sử dụng');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        isActive: dto.isActive ?? true,
        userRoles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: { id: true, email: true, fullName: true, isActive: true, createdAt: true },
    });
  }

  async update(id: string, dto: Partial<CreateUserDto>) {
    await this.findOne(id);

    const data: any = {};
    if (dto.fullName) data.fullName = dto.fullName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.roleIds !== undefined) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      data.userRoles = dto.roleIds.length
        ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
        : undefined;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, fullName: true, isActive: true, updatedAt: true },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, isActive: true } });
  }
}
