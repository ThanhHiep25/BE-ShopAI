import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist } from './schemas/wishlist.schema';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name) private wishlistModel: Model<Wishlist>,
  ) {}

  async getWishlist(userId: string) {
    const filter: any = { userId: new Types.ObjectId(userId) };
    let wishlist = await this.wishlistModel
      .findOne(filter)
      .populate('products')
      .exec();

    if (!wishlist) {
      await this.wishlistModel.create({
        userId: new Types.ObjectId(userId),
        products: [],
      } as any);
      // Re-fetch with populate to ensure consistent shape
      wishlist = await this.wishlistModel
        .findOne(filter)
        .populate('products')
        .exec();
    }

    return wishlist;
  }

  async toggle(userId: string, productId: string) {
    // Guard: reject empty or invalid product IDs
    if (!productId || !Types.ObjectId.isValid(productId)) {
      throw new BadRequestException(`Invalid productId: "${productId}"`);
    }

    const filter: any = { userId: new Types.ObjectId(userId) };
    let wishlist = await this.wishlistModel.findOne(filter);

    if (!wishlist) {
      await this.wishlistModel.create({
        userId: new Types.ObjectId(userId),
        products: [new Types.ObjectId(productId)],
      } as any);
    } else {
      const index = wishlist.products.findIndex(
        (id) => id.toString() === productId,
      );

      if (index === -1) {
        wishlist.products.push(new Types.ObjectId(productId) as any);
      } else {
        wishlist.products.splice(index, 1);
      }

      await wishlist.save();
    }

    // Always return fully populated result
    return this.wishlistModel
      .findOne(filter)
      .populate('products')
      .exec();
  }
}
