import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: any,
    @Body() payload: { productId: string; rating: number; comment?: string },
  ) {
    return this.reviewsService.create(
      payload.productId,
      req.user.userId,
      payload.rating,
      payload.comment,
    );
  }

  @Get('product/:productId')
  async findByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Get('product/:productId/average')
  async getAverageRating(@Param('productId') productId: string) {
    const average = await this.reviewsService.getAverageRating(productId);
    return { average };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMyReviews(@Request() req: any) {
    return this.reviewsService.findByUser(req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.reviewsService.remove(id, req.user.userId);
    return { message: 'Review deleted' };
  }
}
