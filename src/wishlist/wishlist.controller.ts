import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async getWishlist(@Req() req) {
    return this.wishlistService.getWishlist(req.user.id);
  }

  @Post('toggle/:productId')
  async toggle(@Req() req, @Param('productId') productId: string) {
    return this.wishlistService.toggle(req.user.id, productId);
  }
}
