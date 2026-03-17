import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ai, AiSchema } from './schemas/ai.schema';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ai.name, schema: AiSchema }]),
    ProductsModule,
  ],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService, MongooseModule],
})
export class AiModule {}
