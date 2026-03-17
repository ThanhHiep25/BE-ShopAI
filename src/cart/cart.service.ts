import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';

@Injectable()
export class CartService {
  constructor(@InjectModel(Cart.name) private cartModel: Model<CartDocument>) {}

  async getCart(userId: string): Promise<CartDocument> {
    let cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('items.productId');

    if (!cart) {
      cart = await this.cartModel.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }
    return cart;
  }

  async addItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartDocument> {
    const cart = await this.getCart(userId);
    const itemIndex = cart.items.findIndex(
      (item: any) => (item.productId._id || item.productId).toString() === productId,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId: new Types.ObjectId(productId), quantity } as any);
    }

    return cart.save();
  }

  async removeItem(userId: string, productId: string): Promise<CartDocument> {
    const cart = await this.getCart(userId);
    cart.items = cart.items.filter(
      (item: any) => (item.productId._id || item.productId).toString() !== productId,
    );
    return cart.save();
  }

  async removeItems(userId: string, productIds: string[]): Promise<CartDocument> {
    const cart = await this.getCart(userId);
    cart.items = cart.items.filter(
      (item: any) => !productIds.includes((item.productId._id || item.productId).toString()),
    );
    return cart.save();
  }

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartDocument> {
    const cart = await this.getCart(userId);
    const itemIndex = cart.items.findIndex(
      (item: any) => (item.productId._id || item.productId).toString() === productId,
    );

    if (itemIndex > -1) {
      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }
      return cart.save();
    }
    throw new NotFoundException('Product not found in cart');
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { items: [] },
    );
  }
}
