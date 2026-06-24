import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly REFRESH_COOKIE = 'refresh_token';

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      permissions,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id, req);

    this.setRefreshCookie(res, refreshToken);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, permissions },
    };
  }

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[this.REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh token không tồn tại');

    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: { include: { rolePermissions: { include: { permission: true } } } },
              },
            },
          },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token hết hạn hoặc không hợp lệ');
    }

    if (!stored.user.isActive) throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const permissions = [
      ...new Set(
        stored.user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    const payload: JwtPayload = {
      sub: stored.user.id,
      email: stored.user.email,
      fullName: stored.user.fullName,
      permissions,
    };

    const accessToken = this.jwt.sign(payload);
    const newRefreshToken = await this.createRefreshToken(stored.user.id, req);
    this.setRefreshCookie(res, newRefreshToken);

    return { accessToken };
  }

  async logout(userId: string, req: Request, res: Response) {
    const token = req.cookies?.[this.REFRESH_COOKIE];
    if (token) {
      const tokenHash = this.hashToken(token);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.clearCookie(this.REFRESH_COOKIE);
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: userId,
        ipAddress: req.ip,
      },
    });

    return { message: 'Đăng xuất thành công' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException();

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    const roles = user.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name }));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles,
      permissions,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  private async createRefreshToken(userId: string, req: Request): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(token);
    const ttl = this.config.get<number>('JWT_REFRESH_TOKEN_TTL', 604800);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private setRefreshCookie(res: Response, token: string) {
    const ttl = this.config.get<number>('JWT_REFRESH_TOKEN_TTL', 604800);
    res.cookie(this.REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ttl * 1000,
    });
  }
}
