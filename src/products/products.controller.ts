import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async create(@Body() createProductDto: any, @Request() req: any) {
    return this.productsService.create(createProductDto, req.user.userId);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1, 
    @Query('limit') limit: number = 10,
    @Query('category') category?: string,
    @Query('q') query?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('minRating') minRating?: number,
    @Query('sort') sort?: 'price_asc' | 'price_desc' | 'newest' | 'rating_desc',
  ) {
    return this.productsService.findAll(
      +page, 
      +limit, 
      category, 
      query, 
      minPrice ? +minPrice : undefined,
      maxPrice ? +maxPrice : undefined,
      minRating ? +minRating : undefined,
      sort
    );
  }

  @Get(':id/similar')
  async findSimilar(@Param('id') id: string, @Query('limit') limit: number = 4) {
    return this.productsService.findSimilar(id, +limit);
  }

  @Get('categories')
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async update(@Param('id') id: string, @Body() updateProductDto: any) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get('seller/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async findMyProducts(@Request() req: any) {
    return this.productsService.findBySeller(req.user.userId);
  }
}
