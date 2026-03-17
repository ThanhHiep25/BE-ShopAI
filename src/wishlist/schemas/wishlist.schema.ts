import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Wishlist extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }])
  products: MongooseSchema.Types.ObjectId[];
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);
