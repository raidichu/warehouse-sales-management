import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async inventorySummary(warehouseId?: string) {
    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;

    return this.prisma.inventory.findMany({
      where,
      include: {
        product: { select: { sku: true, name: true, minStockQty: true } },
        warehouse: { select: { code: true, name: true } },
        location: { select: { code: true, name: true } },
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { product: { name: 'asc' } }],
    });
  }

  async stockMovements(params: {
    productId?: string;
    warehouseId?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.productId) where.productId = params.productId;
    if (params.warehouseId) where.warehouseId = params.warehouseId;
    if (params.type) where.type = params.type;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        include: {
          product: { select: { sku: true, name: true } },
          warehouse: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async salesRevenue(params: { from?: string; to?: string; customerId?: string }) {
    const where: any = { status: 'CONFIRMED' };
    if (params.customerId) where.customerId = params.customerId;
    if (params.from || params.to) {
      where.invoiceDate = {};
      if (params.from) where.invoiceDate.gte = new Date(params.from);
      if (params.to) where.invoiceDate.lte = new Date(params.to);
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { code: true, name: true } },
        lines: { include: { product: { select: { sku: true, name: true } } } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const summary = {
      totalInvoices: invoices.length,
      totalRevenue: invoices.reduce((s, i) => s + Number(i.grandTotal), 0),
      totalTax: invoices.reduce((s, i) => s + Number(i.taxAmount), 0),
      netRevenue: invoices.reduce((s, i) => s + Number(i.subtotal), 0),
    };

    return { summary, data: invoices };
  }

  async purchaseSummary(params: { from?: string; to?: string; supplierId?: string }) {
    const where: any = { status: 'CONFIRMED' };
    if (params.supplierId) where.supplierId = params.supplierId;
    if (params.from || params.to) {
      where.receiptDate = {};
      if (params.from) where.receiptDate.gte = new Date(params.from);
      if (params.to) where.receiptDate.lte = new Date(params.to);
    }

    const grns = await this.prisma.goodsReceiptNote.findMany({
      where,
      include: {
        supplier: { select: { code: true, name: true } },
        lines: { include: { product: { select: { sku: true, name: true } } } },
      },
      orderBy: { receiptDate: 'desc' },
    });

    const summary = {
      totalGRNs: grns.length,
      totalPurchaseValue: grns.reduce((s, g) => s + Number(g.grandTotal), 0),
    };

    return { summary, data: grns };
  }

  async arAgingReport() {
    const now = new Date();
    const records = await this.prisma.accountsReceivable.findMany({
      where: { status: { not: 'PAID' } },
      include: {
        customer: { select: { code: true, name: true } },
        invoice: { select: { invoiceNumber: true, invoiceDate: true } },
      },
    });

    const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const rows = records.map((r) => {
      const days = Math.max(0, Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000));
      const bucket =
        days === 0 ? 'current'
          : days <= 30 ? '1-30'
            : days <= 60 ? '31-60'
              : days <= 90 ? '61-90'
                : '90+';
      buckets[bucket] += Number(r.amountRemaining);
      return { ...r, overdueDays: days, bucket };
    });

    return { buckets, data: rows };
  }

  async apAgingReport() {
    const now = new Date();
    const records = await this.prisma.accountsPayable.findMany({
      where: { status: { not: 'PAID' } },
      include: {
        supplier: { select: { code: true, name: true } },
        grn: { select: { grnNumber: true, receiptDate: true } },
      },
    });

    const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const rows = records.map((r) => {
      const days = Math.max(0, Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000));
      const bucket =
        days === 0 ? 'current'
          : days <= 30 ? '1-30'
            : days <= 60 ? '31-60'
              : days <= 90 ? '61-90'
                : '90+';
      buckets[bucket] += Number(r.amountRemaining);
      return { ...r, overdueDays: days, bucket };
    });

    return { buckets, data: rows };
  }

  async dashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      totalProducts,
      totalCustomers,
      totalSuppliers,
      monthlyRevenue,
      yearlyRevenue,
      pendingPOs,
      pendingSOs,
      lowStockItems,
      overdueAR,
      overdueAP,
    ] = await Promise.all([
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.customer.count({ where: { isActive: true } }),
      this.prisma.supplier.count({ where: { isActive: true } }),
      this.prisma.invoice.aggregate({
        where: { status: 'CONFIRMED', invoiceDate: { gte: monthStart } },
        _sum: { grandTotal: true },
      }),
      this.prisma.invoice.aggregate({
        where: { status: 'CONFIRMED', invoiceDate: { gte: yearStart } },
        _sum: { grandTotal: true },
      }),
      this.prisma.purchaseOrder.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.salesOrder.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.$queryRaw<any[]>`
        SELECT i.id, i.quantity, p.sku, p.name, p.min_stock_qty as "minStockQty", w.code as "warehouseCode"
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        JOIN warehouses w ON w.id = i.warehouse_id
        WHERE p.min_stock_qty > 0
          AND i.quantity < p.min_stock_qty
        LIMIT 10
      `.catch(() => []),
      this.prisma.accountsReceivable.aggregate({
        where: { status: { not: 'PAID' }, dueDate: { lt: now } },
        _sum: { amountRemaining: true },
        _count: true,
      }),
      this.prisma.accountsPayable.aggregate({
        where: { status: { not: 'PAID' }, dueDate: { lt: now } },
        _sum: { amountRemaining: true },
        _count: true,
      }),
    ]);

    return {
      overview: { totalProducts, totalCustomers, totalSuppliers },
      revenue: {
        monthly: Number(monthlyRevenue._sum.grandTotal ?? 0),
        yearly: Number(yearlyRevenue._sum.grandTotal ?? 0),
      },
      pending: { purchaseOrders: pendingPOs, salesOrders: pendingSOs },
      alerts: {
        overdueAR: { count: overdueAR._count, amount: Number(overdueAR._sum.amountRemaining ?? 0) },
        overdueAP: { count: overdueAP._count, amount: Number(overdueAP._sum.amountRemaining ?? 0) },
        lowStock: lowStockItems,
      },
    };
  }
}
