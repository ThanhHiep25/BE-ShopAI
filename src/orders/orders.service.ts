import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

import { NotificationsService } from '../notifications/notifications.service';
import { formatCurrency } from '../utils';

type CheckoutItemInput = {
  productId: string;
  quantity: number;
};

type CheckoutPayload = {
  items: CheckoutItemInput[];
  note?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkout(payload: CheckoutPayload, userId: string) {
    const normalizedItems = payload.items.filter((item) => item.quantity > 0);
    const productIds = normalizedItems.map(
      (item) => new Types.ObjectId(item.productId),
    );

    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .exec();
    if (products.length !== normalizedItems.length) {
      throw new NotFoundException('Some products do not exist');
    }

    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    // Check stock availability
    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);
      if (product && product.stock < item.quantity) {
        throw new BadRequestException(
          `Sản phẩm "${product.name}" đã hết hàng hoặc không đủ số lượng.`,
        );
      }
    }

    const items = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      return {
        productId: product._id,
        sellerId: product.sellerId,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
      };
    });

    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const order = await this.orderModel.create({
      user: new Types.ObjectId(userId),
      items,
      total,
      status: 'created',
      note: payload.note,
    });

    // Update stock and salesCount
    for (const item of normalizedItems) {
      await this.productModel
        .updateOne(
          { _id: new Types.ObjectId(item.productId) },
          {
            $inc: {
              stock: -item.quantity,
              salesCount: item.quantity,
            },
          },
        )
        .exec();
    }

    const createdOrder = order.toObject<{ createdAt?: Date }>();

    // Send Notification to User
    await this.notificationsService.create({
      recipientId: userId,
      title: '📦 Order Created!',
      message: `Your order #${String(order._id).slice(-6).toUpperCase()} for ${formatCurrency(total)} has been successfully placed.`,
      type: 'order',
    });

    return {
      orderId: String(order._id),
      total: order.total,
      status: order.status,
      createdAt: createdOrder.createdAt,
    };
  }

  async getOrderHistory(userId: string) {
    const orders = await this.orderModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    return orders.map((order) => {
      const orderObject = order.toObject<{ createdAt?: Date }>();

      return {
        id: String(order._id),
        total: order.total,
        status: order.status,
        createdAt: orderObject.createdAt,
        note: order.note,
        items: order.items.map((item) => ({
          productId: String(item.productId),
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
        })),
      };
    });
  }

  async getSellerAnalytics(sellerId: string) {
    const sellerObjectId = new Types.ObjectId(sellerId);
    const orders = await this.orderModel
      .find({ 'items.sellerId': sellerObjectId })
      .exec();

    let totalRevenue = 0;
    let totalOrders = 0;
    const soldMap = new Map<string, number>();

    for (const order of orders) {
      let sellerRevenueInOrder = 0;
      for (const item of order.items) {
        if (String(item.sellerId) !== String(sellerObjectId)) {
          continue;
        }
        const soldCount = soldMap.get(item.productName) ?? 0;
        soldMap.set(item.productName, soldCount + item.quantity);
        sellerRevenueInOrder += item.price * item.quantity;
      }

      if (sellerRevenueInOrder > 0) {
        totalOrders += 1;
        totalRevenue += sellerRevenueInOrder;
      }
    }

    const topProducts = [...soldMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([productName, sold]) => ({ productName, sold }));

    return {
      totalRevenue,
      totalOrders,
      monthlyGrowthPercent: 0,
      topProducts,
    };
  }

  async getSellerOrders(sellerId: string) {
    const sellerObjectId = new Types.ObjectId(sellerId);
    // Find orders containing items from this seller
    const orders = await this.orderModel
      .find({ 'items.sellerId': sellerObjectId })
      .sort({ createdAt: -1 })
      .exec();

    return orders.map((order) => {
      const orderObject = order.toObject<{ createdAt?: Date }>();
      // Only include items belonging to this seller in the response for clarity
      const sellerItems = order.items.filter(
        (item) => String(item.sellerId) === sellerId,
      );

      return {
        id: String(order._id),
        status: order.status,
        total: sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        createdAt: orderObject.createdAt,
        items: sellerItems.map((item) => ({
          productId: String(item.productId),
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
        })),
        note: order.note,
      };
    });
  }

  async updateOrderStatus(orderId: string, status: string, sellerId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Security: Check if seller has items in this order
    const hasItems = order.items.some(
      (item) => String(item.sellerId) === sellerId,
    );
    if (!hasItems) {
      throw new BadRequestException('You do not have permission to update this order');
    }

    order.status = status;
    await order.save();

    // Send Notification to Buyer
    await this.notificationsService.create({
      recipientId: String(order.user),
      title: '🚚 Order Update',
      message: `Your order #${String(order._id).slice(-6).toUpperCase()} status has been updated to "${status.toUpperCase()}".`,
      type: 'order',
    });

    return order;
  }
}
