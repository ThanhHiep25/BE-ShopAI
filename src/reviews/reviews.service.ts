import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(@InjectModel(Review.name) private reviewModel: Model<ReviewDocument>) {}

  async create(productId: string, userId: string, rating: number, comment?: string): Promise<ReviewDocument> {
    const review = new this.reviewModel({
      productId: new Types.ObjectId(productId),
      userId: new Types.ObjectId(userId),
      rating,
      comment,
    });
    return review.save();
  }

  async findByProduct(productId: string): Promise<ReviewDocument[]> {
    return this.reviewModel
      .find({ productId: new Types.ObjectId(productId) })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<ReviewDocument[]> {
    return this.reviewModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('productId', 'name images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async remove(id: string, userId: string): Promise<void> {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }
    await this.reviewModel.deleteOne({ _id: id });
  }

  async getAverageRating(productId: string): Promise<number> {
    const result = await this.reviewModel.aggregate([
      { $match: { productId: new Types.ObjectId(productId) } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' } } },
    ]);
    return result.length > 0 ? result[0].avgRating : 0;
  }
}
