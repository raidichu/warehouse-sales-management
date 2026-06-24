import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { RolesService, CreateRoleDto } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { IsArray, IsUUID } from 'class-validator';

class UpdatePermissionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get('permissions')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Get('roles')
  @Permissions('role:manage')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('roles/:id')
  @Permissions('role:manage')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post('roles')
  @Permissions('role:manage')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put('roles/:id/permissions')
  @Permissions('role:manage')
  updatePermissions(@Param('id') id: string, @Body() dto: UpdatePermissionsDto) {
    return this.rolesService.updatePermissions(id, dto.permissionIds);
  }
}
