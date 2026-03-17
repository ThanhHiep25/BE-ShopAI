import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async findByUser(userId: string): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({ recipientId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id, recipientId: new Types.ObjectId(userId) },
      { isRead: true },
      { new: true },
    );
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(userId) },
      { isRead: true },
    );
  }

  async clearAll(userId: string): Promise<void> {
    await this.notificationModel.deleteMany({
      recipientId: new Types.ObjectId(userId),
    });
  }

  async create(data: {
    recipientId: string;
    title: string;
    message: string;
    type?: string;
  }): Promise<NotificationDocument> {
    const notification = new this.notificationModel({
      ...data,
      recipientId: new Types.ObjectId(data.recipientId),
    });
    return notification.save();
  }
}
