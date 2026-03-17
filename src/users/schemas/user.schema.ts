import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.BUYER })
  role: UserRole;

  @Prop()
  avatar?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
