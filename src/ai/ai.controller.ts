import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('history/:sessionId')
  async history(@Param('sessionId') sessionId: string) {
    return this.aiService.getConversationHistory(sessionId);
  }

  @Post('chat')
  async chat(
    @Body('prompt') prompt: string, 
    @Body('sessionId') sessionId?: string,
    @Body('contextProductId') contextProductId?: string
  ) {
    const result = await this.aiService.recommendProducts(prompt, sessionId, contextProductId);
    return result;
  }

  @Post('recommend')
  async recommend(
    @Body('prompt') prompt: string, 
    @Body('sessionId') sessionId?: string,
    @Body('contextProductId') contextProductId?: string
  ) {
    return this.aiService.recommendProducts(prompt, sessionId, contextProductId);
  }

  @Post('optimize-content')
  async optimizeContent(
    @Body('type') type: 'title' | 'description',
    @Body('text') text: string,
    @Body('name') name?: string,
  ) {
    const optimized = await this.aiService.optimizeContent(type, text, name);
    return { optimized };
  }

  @Post('suggest-price')
  async suggestPrice(
    @Body('name') name: string,
    @Body('category') category?: string,
  ) {
    return this.aiService.suggestPrice(name, category);
  }

  @Post('analyze-image')
  @UseInterceptors(FileInterceptor('image'))
  async analyzeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('prompt') prompt: string,
    @Body('sessionId') sessionId?: string,
  ) {
    const finalPrompt = prompt || 'Analyze this product image and give me details.';
    const response = await this.aiService.analyzeImageWithGemini(
      file.buffer,
      finalPrompt,
    );

    await this.aiService.logConversation({
      sessionId,
      prompt: finalPrompt,
      response,
      model: 'gemini-2.5-flash-image',
      recommendedProducts: [],
    });

    return {
      response,
    };
  }
}
