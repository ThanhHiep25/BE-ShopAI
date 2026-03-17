import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from './users/schemas/user.schema';
import { Product, ProductDocument } from './products/schemas/product.schema';
import { Order, OrderDocument } from './orders/schemas/order.schema';
import { Chat, ChatDocument } from './chat/schemas/chat.schema';
import { Ai, AiDocument } from './ai/schemas/ai.schema';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Ai.name) private aiModel: Model<AiDocument>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async onApplicationBootstrap() {
    console.log('--- Checking and Initializing All Collections ---');

    // Init User (Seller)
    let seller = await this.userModel.findOne({ role: UserRole.SELLER });
    if (!seller) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      seller = await this.userModel.create({
        email: 'seller@shopai.com',
        name: 'Shop Seller',
        password: hashedPassword,
        role: UserRole.SELLER,
      });
      console.log('✔ Seller created');
    }

    // Init User (Buyer)
    let buyer = await this.userModel.findOne({ role: UserRole.BUYER });
    if (!buyer) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      buyer = await this.userModel.create({
        email: 'buyer@shopai.com',
        name: 'Normal Buyer',
        password: hashedPassword,
        role: UserRole.BUYER,
      });
      console.log('✔ Buyer created');
    }

    // Init Product
    if ((await this.productModel.countDocuments()) === 0) {
      await this.productModel.create({
        name: 'iPhone 15 Pro Max',
        description: 'Latest iPhone with AI features',
        price: 1200,
        images: ['https://example.com/iphone.jpg'],
        sellerId: seller._id,
        category: 'Electronics',
      });
      console.log('✔ Product collection initialized');
    }

    // Init Order
    if ((await this.orderModel.countDocuments()) === 0) {
      await this.orderModel.create({
        user: buyer._id,
        total: 1200,
        status: 'pending',
      });
      console.log('✔ Order collection initialized');
    }

    // Init Chat
    if ((await this.chatModel.countDocuments()) === 0) {
      await this.chatModel.create({
        senderId: buyer._id.toString(),
        message: 'Is this available?',
        room: `room_${buyer._id}_${seller._id}`,
      });
      console.log('✔ Chat collection initialized');
    }

    // Init AI
    if ((await this.aiModel.countDocuments()) === 0) {
      await this.aiModel.create({
        prompt: 'Analyze image',
        response: 'This is a premium smartphone.',
        model: 'gemini-1.5-flash',
      });
      console.log('✔ AI collection initialized');
    }

    console.log('--- All Collections Ready! ---');
  }
}
