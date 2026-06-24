import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Permissions
  const permissions = [
    // Products
    { code: 'product:read',     name: 'Xem sản phẩm',      module: 'products' },
    { code: 'product:create',   name: 'Tạo sản phẩm',      module: 'products' },
    { code: 'product:update',   name: 'Sửa sản phẩm',      module: 'products' },
    { code: 'product:delete',   name: 'Xóa sản phẩm',      module: 'products' },
    // Warehouse
    { code: 'warehouse:read',   name: 'Xem kho',            module: 'warehouse' },
    { code: 'warehouse:manage', name: 'Quản lý kho',        module: 'warehouse' },
    // Inventory
    { code: 'inventory:read',   name: 'Xem tồn kho',        module: 'inventory' },
    { code: 'stock:receipt',    name: 'Nhập kho',            module: 'inventory' },
    { code: 'stock:issue',      name: 'Xuất kho',            module: 'inventory' },
    { code: 'stock:transfer',   name: 'Chuyển kho',          module: 'inventory' },
    { code: 'stock:taking',     name: 'Kiểm kê kho',         module: 'inventory' },
    // Purchases
    { code: 'supplier:read',    name: 'Xem nhà cung cấp',   module: 'purchases' },
    { code: 'supplier:manage',  name: 'Quản lý NCC',        module: 'purchases' },
    { code: 'po:read',          name: 'Xem đơn mua hàng',   module: 'purchases' },
    { code: 'po:create',        name: 'Tạo đơn mua hàng',   module: 'purchases' },
    { code: 'po:approve',       name: 'Duyệt đơn mua hàng', module: 'purchases' },
    { code: 'grn:create',       name: 'Tạo phiếu nhập NCC', module: 'purchases' },
    { code: 'grn:confirm',      name: 'Xác nhận nhập hàng', module: 'purchases' },
    { code: 'ap:manage',        name: 'Quản lý công nợ NCC',module: 'purchases' },
    // Sales
    { code: 'customer:read',    name: 'Xem khách hàng',     module: 'sales' },
    { code: 'customer:manage',  name: 'Quản lý KH',         module: 'sales' },
    { code: 'quotation:manage', name: 'Quản lý báo giá',    module: 'sales' },
    { code: 'so:create',        name: 'Tạo đơn bán hàng',   module: 'sales' },
    { code: 'so:confirm',       name: 'Xác nhận đơn BH',    module: 'sales' },
    { code: 'gdn:create',       name: 'Tạo phiếu giao hàng',module: 'sales' },
    { code: 'gdn:confirm',      name: 'Xác nhận giao hàng', module: 'sales' },
    { code: 'invoice:manage',   name: 'Quản lý hóa đơn',    module: 'sales' },
    { code: 'ar:manage',        name: 'Quản lý công nợ KH', module: 'sales' },
    // Reports
    { code: 'report:inventory', name: 'BC tồn kho',         module: 'reports' },
    { code: 'report:sales',     name: 'BC doanh thu',        module: 'reports' },
    { code: 'report:purchases', name: 'BC mua hàng',         module: 'reports' },
    { code: 'report:ar_ap',     name: 'BC công nợ',          module: 'reports' },
    { code: 'report:dashboard', name: 'Dashboard',           module: 'reports' },
    // Admin
    { code: 'user:manage',      name: 'Quản lý người dùng', module: 'admin' },
    { code: 'role:manage',      name: 'Quản lý vai trò',    module: 'admin' },
    { code: 'config:manage',    name: 'Cấu hình hệ thống',  module: 'admin' },
    { code: 'audit:read',       name: 'Xem nhật ký',        module: 'admin' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // Admin role — has all permissions
  const allPerms = await prisma.permission.findMany();
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Toàn quyền hệ thống',
      rolePermissions: {
        create: allPerms.map((p) => ({ permissionId: p.id })),
      },
    },
  });

  // Warehouse Manager role
  const wmPerms = allPerms.filter((p) =>
    ['inventory', 'warehouse', 'products'].includes(p.module) ||
    p.code === 'report:inventory',
  );
  await prisma.role.upsert({
    where: { name: 'Warehouse Manager' },
    update: {},
    create: {
      name: 'Warehouse Manager',
      description: 'Quản lý kho hàng',
      rolePermissions: { create: wmPerms.map((p) => ({ permissionId: p.id })) },
    },
  });

  // Sales Staff role
  const salesPerms = allPerms.filter((p) =>
    p.module === 'sales' || p.code === 'product:read' || p.code === 'inventory:read' || p.code === 'report:sales',
  );
  await prisma.role.upsert({
    where: { name: 'Sales Staff' },
    update: {},
    create: {
      name: 'Sales Staff',
      description: 'Nhân viên bán hàng',
      rolePermissions: { create: salesPerms.map((p) => ({ permissionId: p.id })) },
    },
  });

  // Purchase Staff role
  const purchasePerms = allPerms.filter((p) =>
    p.module === 'purchases' || p.code === 'product:read' || p.code === 'report:purchases',
  );
  await prisma.role.upsert({
    where: { name: 'Purchase Staff' },
    update: {},
    create: {
      name: 'Purchase Staff',
      description: 'Nhân viên mua hàng',
      rolePermissions: { create: purchasePerms.map((p) => ({ permissionId: p.id })) },
    },
  });

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@123456', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@wsms.local' },
    update: {},
    create: {
      email: 'admin@wsms.local',
      passwordHash,
      fullName: 'System Administrator',
      userRoles: { create: { roleId: adminRole.id } },
    },
  });

  // System configs
  const configs = [
    { key: 'company_name',       value: 'Công ty TNHH ABC',           description: 'Tên công ty' },
    { key: 'company_address',    value: '123 Đường ABC, Quận 1, HCM', description: 'Địa chỉ công ty' },
    { key: 'company_phone',      value: '028-1234-5678',              description: 'Số điện thoại' },
    { key: 'company_email',      value: 'info@abc.com.vn',            description: 'Email liên hệ' },
    { key: 'company_tax_code',   value: '0123456789',                 description: 'Mã số thuế' },
    { key: 'currency',           value: 'VND',                        description: 'Đơn vị tiền tệ' },
    { key: 'date_format',        value: 'DD/MM/YYYY',                 description: 'Định dạng ngày' },
    { key: 'po_prefix',          value: 'PO',                         description: 'Tiền tố đơn mua' },
    { key: 'grn_prefix',         value: 'GRN',                        description: 'Tiền tố phiếu nhập NCC' },
    { key: 'so_prefix',          value: 'SO',                         description: 'Tiền tố đơn bán' },
    { key: 'gdn_prefix',         value: 'GDN',                        description: 'Tiền tố phiếu xuất' },
    { key: 'inv_prefix',         value: 'INV',                        description: 'Tiền tố hóa đơn' },
    { key: 'receipt_prefix',     value: 'NK',                         description: 'Tiền tố phiếu nhập kho' },
    { key: 'issue_prefix',       value: 'XK',                         description: 'Tiền tố phiếu xuất kho' },
    { key: 'transfer_prefix',    value: 'CK',                         description: 'Tiền tố phiếu chuyển kho' },
  ];

  for (const c of configs) {
    await prisma.systemConfig.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    });
  }

  // Default warehouse
  await prisma.warehouse.upsert({
    where: { code: 'WH-001' },
    update: {},
    create: {
      code: 'WH-001',
      name: 'Kho Chính',
      address: '123 Đường ABC, Quận 1, HCM',
    },
  });

  // Default UoMs
  const uoms = [
    { name: 'Cái', symbol: 'cái' },
    { name: 'Hộp', symbol: 'hộp' },
    { name: 'Thùng', symbol: 'thùng' },
    { name: 'Kilogram', symbol: 'kg' },
    { name: 'Lít', symbol: 'lít' },
    { name: 'Mét', symbol: 'm' },
    { name: 'Bộ', symbol: 'bộ' },
  ];
  for (const u of uoms) {
    await prisma.unitOfMeasure.upsert({
      where: { symbol: u.symbol } as any,
      update: {},
      create: u,
    });
  }

  console.log(`✓ Seed completed. Admin: admin@wsms.local / Admin@123456`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
