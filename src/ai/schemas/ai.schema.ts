import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiDocument = Ai & Document;

@Schema({ timestamps: true })
export class Ai {
  @Prop({ required: true, default: 'default' })
  sessionId: string;

  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  response: string;

  @Prop({
    type: [
      {
        id: String,
        name: String,
        description: String,
        price: Number,
        category: String,
        imageUrl: String,
      },
    ],
    default: [],
  })
  recommendedProducts: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    category?: string;
    imageUrl?: string;
  }>;

  @Prop()
  model: string;
}

export const AiSchema = SchemaFactory.createForClass(Ai);
