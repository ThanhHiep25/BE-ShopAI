import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Put,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  async addItem(
    @Request() req: any,
    @Body() payload: { productId: string; quantity: number },
  ) {
    return this.cartService.addItem(
      req.user.userId,
      payload.productId,
      payload.quantity || 1,
    );
  }

  @Put('items/:productId')
  async updateQuantity(
    @Request() req: any,
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartService.updateQuantity(req.user.userId, productId, quantity);
  }

  @Delete('items/:productId')
  async removeItem(@Request() req: any, @Param('productId') productId: string) {
    return this.cartService.removeItem(req.user.userId, productId);
  }

  @Delete('remove-items')
  async removeItems(@Request() req: any, @Body('productIds') productIds: string[]) {
    return this.cartService.removeItems(req.user.userId, productIds);
  }

  @Delete('clear')
  async clearCart(@Request() req: any) {
    return this.cartService.clearCart(req.user.userId);
  }
}
