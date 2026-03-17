import { Body, Controller, Get, Post, Request, UseGuards, Param, Put } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  async checkout(
    @Body() payload: { items: Array<{ productId: string; quantity: number }>; note?: string },
    @Request() req: any,
  ) {
    return this.ordersService.checkout(payload, req.user.userId);
  }

  @Get('history/me')
  async getOrderHistory(@Request() req: any) {
    return this.ordersService.getOrderHistory(req.user.userId);
  }

  @Get('analytics/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async getSellerAnalytics(@Request() req: any) {
    return this.ordersService.getSellerAnalytics(req.user.userId);
  }

  @Get('seller/items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async getSellerOrders(@Request() req: any) {
    return this.ordersService.getSellerOrders(req.user.userId);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.ordersService.updateOrderStatus(id, status, req.user.userId);
  }
}
