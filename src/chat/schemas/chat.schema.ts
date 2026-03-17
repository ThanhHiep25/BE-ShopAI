import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  room: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
