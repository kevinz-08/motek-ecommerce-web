import { Controller, Get, Inject } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IOrderRepository, IProductRepository } from '@motek/domain'
import { ORDER_REPOSITORY, PRODUCT_REPOSITORY } from '../infrastructure/injection-tokens'
import { Roles } from '../auth/decorators/roles.decorator'

@ApiTags('admin / dashboard')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    @Inject(ORDER_REPOSITORY)   private readonly orderRepo: IOrderRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Métricas del panel admin: ingresos, pedidos pendientes, stock bajo' })
  async summary() {
    const [todayRevenue, pendingCount, lowStockProducts, recentOrders] = await Promise.all([
      this.orderRepo.getTodayRevenue(),
      this.orderRepo.getPendingCount(),
      this.productRepo.findLowStock(5),
      this.orderRepo.findAll({ limit: 5 }),
    ])

    return {
      todayRevenue,
      pendingOrders: pendingCount,
      lowStock: { count: lowStockProducts.length, products: lowStockProducts },
      recentOrders,
    }
  }
}
