import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';

import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private async processImages(images: string[]): Promise<string[]> {
    if (!images || images.length === 0) return [];
    
    const uploadPromises = images.map(async (image) => {
      try {
        // Check if image is a base64 string
        if (image.startsWith('data:image')) {
          this.logger.log('Uploading image to Cloudinary...');
          const result = await this.cloudinaryService.uploadImage(image);
          this.logger.log(`Upload successful: ${result.secure_url}`);
          return result.secure_url;
        }
        return image; // Already a URL
      } catch (error) {
        this.logger.error(`Image upload failed: ${error.message}`);
        throw new BadRequestException(`Image upload failed: ${error.message}`);
      }
    });
    
    return Promise.all(uploadPromises);
  }

  async create(createProductDto: any, sellerId: string): Promise<ProductDocument> {
    this.logger.log(`Creating product for seller: ${sellerId}`);
    try {
      const images = await this.processImages(createProductDto.images || []);
      
      const newProduct = new this.productModel({
        ...createProductDto,
        images,
        sellerId,
      });
      return await newProduct.save();
    } catch (error) {
      this.logger.error(`Product creation failed: ${error.message}`);
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, category?: string, query?: string): Promise<{ products: ProductDocument[], total: number, page: number, lastPage: number }> {
    const skip = (page - 1) * limit;
    const filter: any = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.productModel.find(filter).populate('sellerId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      products,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id).populate('sellerId', 'name email').exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: any): Promise<ProductDocument> {
    const updateData = { ...updateProductDto };
    if (updateData.images) {
      updateData.images = await this.processImages(updateData.images);
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return updatedProduct;
  }

  async remove(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  async findBySeller(sellerId: string): Promise<ProductDocument[]> {
    return this.productModel.find({ sellerId }).exec();
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.productModel.distinct('category').exec();
    return categories.filter(Boolean).sort();
  }
}
