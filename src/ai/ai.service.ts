import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Ai, AiDocument } from './schemas/ai.schema';

type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: string;
  imageUrl?: string;
};

type AiIntent =
  | 'catalog'
  | 'price'
  | 'utility'
  | 'comparison'
  | 'recommendation'
  | 'general';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private genAI: GoogleGenerativeAI;

  constructor(
    private configService: ConfigService,
    @InjectModel(Ai.name) private aiModel: Model<AiDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.genAI = new GoogleGenerativeAI(
      this.configService.get<string>('GEMINI_API_KEY')!,
    );
  }

  async chatWithOpenAI(prompt: string, sessionId?: string): Promise<string> {
    const result = await this.generateRecommendationResult(prompt, sessionId);
    return result.response;
  }

  async recommendProducts(prompt: string, sessionId?: string, contextProductId?: string) {
    return this.generateRecommendationResult(prompt, sessionId, contextProductId);
  }

  async optimizeContent(type: 'title' | 'description', text: string, name?: string): Promise<string> {
    const prompt = type === 'title' 
      ? `Toi la mot chuyen gia marketing. Hay toi uu tieu de san pham sau day de thu hut nguoi mua hon: "${text}". Chi tra ve tieu de moi, khong giai thich them.`
      : `Toi la mot chuyen gia viet noi dung (copywriter). Hay viet mot mo ta san pham chuyen nghiep, day du tinh nang va loi ich cho san pham co ten la "${name || 'san pham nay'}" dua tren cac y tuong sau: "${text}". Tra ve noi dung mo ta bang tieng Viet, co format ro rang.`;

    try {
      return await this.chatWithGemini(prompt);
    } catch {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.choices[0].message.content || text;
    }
  }

  async suggestPrice(name: string, category?: string): Promise<{ suggestedPrice: number; reason: string }> {
    const similarProducts = await this.productModel.find({
      $or: [
        { name: { $regex: name.split(' ')[0], $options: 'i' } },
        { category: category }
      ]
    }).limit(10).lean().exec();

    if (similarProducts.length === 0) {
      return { suggestedPrice: 0, reason: "Khong tim thay san pham tuong tu de so sanh." };
    }

    const avgPrice = similarProducts.reduce((sum, p) => sum + p.price, 0) / similarProducts.length;
    const minPrice = Math.min(...similarProducts.map(p => p.price));
    const maxPrice = Math.max(...similarProducts.map(p => p.price));

    const prompt = `Toi la chuyen gia phan tich gia thi truong. San pham moi ten la "${name}", thuoc danh muc "${category || 'N/A'}". 
    Cac san pham tuong tu co gia tu ${minPrice.toLocaleString()} den ${maxPrice.toLocaleString()} VND, trung binh la ${avgPrice.toLocaleString()} VND.
    Hay goi y mot muc gia ban hop ly va giai thich tai sao. Tra ve format JSON: {"suggestedPrice": number, "reason": "string"}`;

    try {
      const aiResult = await this.chatWithGemini(prompt);
      // Clean possible markdown code blocks
      const cleanJson = aiResult.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch {
      return { 
        suggestedPrice: Math.round(avgPrice), 
        reason: `Dua tren gia trung binh cua ${similarProducts.length} san pham tuong tu trong he thong.` 
      };
    }
  }

  async getConversationHistory(sessionId: string) {
    const logs = await this.aiModel
      .find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean()
      .exec();

    return logs.map((log) => {
      const logObject = log as {
        _id: unknown;
        prompt: string;
        response: string;
        recommendedProducts?: CatalogProduct[];
        createdAt?: Date;
        model?: string;
      };

      return {
        id: String(logObject._id),
        prompt: logObject.prompt,
        response: logObject.response,
        recommendedProducts: logObject.recommendedProducts ?? [],
        createdAt: logObject.createdAt,
        model: logObject.model,
      };
    });
  }

  async logConversation(payload: {
    sessionId?: string;
    prompt: string;
    response: string;
    model: string;
    recommendedProducts: CatalogProduct[];
  }): Promise<void> {
    await this.aiModel.create({
      sessionId: payload.sessionId || 'default',
      prompt: payload.prompt,
      response: payload.response,
      model: payload.model,
      recommendedProducts: payload.recommendedProducts,
    });
  }

  async chatWithGemini(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async analyzeImageWithGemini(
    imageBuffer: Buffer,
    prompt: string,
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async getCatalogProducts(): Promise<CatalogProduct[]> {
    const products = await this.productModel.find().limit(100).lean().exec();

    return products.map((product) => ({
      id: String(product._id),
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      imageUrl: product.images?.[0],
    }));
  }

  private async generateRecommendationResult(
    prompt: string,
    sessionId?: string,
    contextProductId?: string,
  ): Promise<{
    response: string;
    products: CatalogProduct[];
  }> {
    const resolvedSessionId = sessionId || 'default';
    const products = await this.getCatalogProducts();
    const recentContext = await this.getRecentSessionContext(resolvedSessionId);
    
    let productContextInfo = '';
    let contextProductObj: CatalogProduct | null = null;
    
    if (contextProductId) {
      const dbProduct = await this.productModel.findById(contextProductId).lean().exec();
      if (dbProduct) {
        contextProductObj = {
          id: String(dbProduct._id),
          name: dbProduct.name,
          description: dbProduct.description,
          price: dbProduct.price,
          category: dbProduct.category,
          imageUrl: dbProduct.images?.[0],
        };
        productContextInfo = `CHÚ Ý: Người dùng ĐANG XEM sản phẩm này: 
        - Tên: ${contextProductObj.name}
        - Giá: ${contextProductObj.price.toLocaleString('vi-VN')} VND
        - Danh mục: ${contextProductObj.category || 'N/A'}
        - Mô tả: ${contextProductObj.description}
        Hãy ƯU TIÊN trả lời các câu hỏi dựa trên sản phẩm này. Nếu người dùng hỏi chung chung như 'nó có tốt không' hay 'giá bao nhiêu', hãy hiểu là họ đang hỏi về sản phẩm này.`;
      }
    }

    const intent = this.detectIntent(prompt);
    let relevantProducts = this.findRelevantProducts(
      prompt,
      products,
      intent,
    );

    // If we have a context product, make sure it's at the top of the list
    if (contextProductObj) {
      relevantProducts = [
        contextProductObj,
        ...relevantProducts.filter(p => p.id !== contextProductObj?.id)
      ].slice(0, 5);
    }

    if (this.shouldUseDirectCatalogAnswer(intent, relevantProducts)) {
      const responseText = this.generateCatalogFallback(
        prompt,
        products,
        relevantProducts,
        intent,
      );

      const result = {
        response: responseText,
        products: relevantProducts.slice(0, intent === 'comparison' ? 2 : 3),
      };

      await this.logConversation({
        sessionId: resolvedSessionId,
        prompt,
        response: result.response,
        model: 'catalog-fallback',
        recommendedProducts: result.products,
      });

      return result;
    }

    const groundedPrompt = this.buildGroundedPrompt(
      prompt,
      products,
      relevantProducts,
      intent,
      recentContext,
      productContextInfo,
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'Ban la tu van vien ShopAI. Tra loi bang tieng Viet, uu tien dua tren catalog san pham duoc cung cap. Khi nguoi dung hoi ve san pham, gia, cong dung, so sanh, hay dua tren du lieu catalog truoc. Neu catalog khong co thong tin thi noi ro rang khong thay du lieu thay vi tu che.',
          },
          { role: 'user', content: groundedPrompt },
        ],
      });

      const result = {
        response: response.choices[0].message.content || 'No response',
        products: relevantProducts.slice(0, 3),
      };

      await this.logConversation({
        sessionId: resolvedSessionId,
        prompt,
        response: result.response,
        model: 'gpt-3.5-turbo',
        recommendedProducts: result.products,
      });

      return result;
    } catch (error: any) {
      console.error('OpenAI Error:', error.message);
      try {
        const result = {
          response: await this.chatWithGemini(groundedPrompt),
          products: relevantProducts.slice(0, 3),
        };

        await this.logConversation({
          sessionId: resolvedSessionId,
          prompt,
          response: result.response,
          model: 'gemini-2.5-flash',
          recommendedProducts: result.products,
        });

        return result;
      } catch {
        const result = {
          response: this.generateCatalogFallback(
            prompt,
            products,
            relevantProducts,
            intent,
          ),
          products: relevantProducts.slice(0, intent === 'comparison' ? 2 : 3),
        };

        await this.logConversation({
          sessionId: resolvedSessionId,
          prompt,
          response: result.response,
          model: 'catalog-fallback',
          recommendedProducts: result.products,
        });

        return result;
      }
    }
  }

  private async getRecentSessionContext(sessionId: string): Promise<string> {
    const recent = await this.aiModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean()
      .exec();

    if (recent.length === 0) {
      return '';
    }

    return recent
      .reverse()
      .map(
        (entry, index) =>
          `${index + 1}. User: ${entry.prompt}\nAssistant: ${entry.response}`,
      )
      .join('\n\n');
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  private tokenizePrompt(prompt: string): string[] {
    return this.normalizeText(prompt)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2);
  }

  private detectIntent(prompt: string): AiIntent {
    const normalizedPrompt = this.normalizeText(prompt);

    if (/so sanh|compare|khac nhau|tot hon|nen mua/.test(normalizedPrompt)) {
      return 'comparison';
    }

    if (/gia|bao nhieu|price|cost|re nhat|dat nhat/.test(normalizedPrompt)) {
      return 'price';
    }

    if (/cong dung|tinh nang|dung de|lam gi|chuc nang/.test(normalizedPrompt)) {
      return 'utility';
    }

    if (
      /goi y|tu van|phu hop|nen mua gi|ngan sach|duoi|tam gia/.test(
        normalizedPrompt,
      )
    ) {
      return 'recommendation';
    }

    if (
      /giat|phoi|say|tu lanh|dieu hoa|gia dung|tv|tivi|may anh/.test(
        normalizedPrompt,
      )
    ) {
      return 'recommendation';
    }

    return 'general';
  }

  private extractBudget(prompt: string): number | null {
    const normalizedPrompt = this.normalizeText(prompt);

    const millionMatch = normalizedPrompt.match(
      /(\d+(?:[\.,]\d+)?)\s*(tr|trieu|m|million)/,
    );
    if (millionMatch) {
      return Number(millionMatch[1].replace(',', '.')) * 1_000_000;
    }

    const thousandMatch = normalizedPrompt.match(
      /(\d+(?:[\.,]\d+)?)\s*(k|nghin)/,
    );
    if (thousandMatch) {
      return Number(thousandMatch[1].replace(',', '.')) * 1_000;
    }

    const plainNumberMatch = normalizedPrompt.match(
      /(duoi|toi da|tam|khoang|gan)\s*(\d{5,9})/,
    );
    if (plainNumberMatch) {
      return Number(plainNumberMatch[2]);
    }

    return null;
  }

  private matchesBudget(prompt: string, price: number): boolean {
    const budget = this.extractBudget(prompt);
    if (!budget) {
      return true;
    }

    const normalizedPrompt = this.normalizeText(prompt);
    if (
      /tren|hon/.test(normalizedPrompt) &&
      !/duoi|toi da/.test(normalizedPrompt)
    ) {
      return price >= budget;
    }

    return price <= budget;
  }

  private getPromptCategories(
    prompt: string,
    products: CatalogProduct[],
  ): string[] {
    const normalizedPrompt = this.normalizeText(prompt);
    return [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ]
      .map((category) => category as string)
      .filter((category) =>
        normalizedPrompt.includes(this.normalizeText(category)),
      );
  }

  private findRelevantProducts(
    prompt: string,
    products: CatalogProduct[],
    intent: AiIntent,
  ): CatalogProduct[] {
    const tokens = this.tokenizePrompt(prompt);
    const categoryMatches = this.getPromptCategories(prompt, products);

    const baseProducts = products.filter((product) => {
      const categoryMatched =
        categoryMatches.length === 0 ||
        categoryMatches.includes(product.category ?? '');
      const budgetMatched = this.matchesBudget(prompt, product.price);
      return categoryMatched && budgetMatched;
    });

    const candidateProducts = baseProducts.length > 0 ? baseProducts : products;

    if (tokens.length === 0) {
      if (intent === 'price') {
        return [...candidateProducts]
          .sort((a, b) => a.price - b.price)
          .slice(0, 5);
      }

      return candidateProducts.slice(0, 5);
    }

    const scored = candidateProducts
      .map((product) => {
        const searchable = this.normalizeText(
          `${product.name} ${product.category ?? ''} ${product.description}`,
        );
        const score = tokens.reduce(
          (sum, token) => sum + (searchable.includes(token) ? 1 : 0),
          0,
        );
        return { product, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      // If we don't have a specific match, and the intent is catalog or general, we can return some featured ones.
      // But for recommendation or price, we should BE HONEST and return empty if no good match.
      if (intent === 'catalog' || intent === 'general') {
        return candidateProducts.slice(0, 5);
      }
      return [];
    }

    const ranked = scored.slice(0, 5).map((item) => item.product);

    if (intent === 'comparison') {
      return ranked.slice(0, 2);
    }

    return ranked;
  }

  private shouldUseDirectCatalogAnswer(
    intent: AiIntent,
    relevantProducts: CatalogProduct[],
  ): boolean {
    return (
      intent === 'catalog' ||
      intent === 'price' ||
      intent === 'utility' ||
      (intent === 'comparison' && relevantProducts.length >= 2)
    );
  }

  private buildGroundedPrompt(
    prompt: string,
    products: CatalogProduct[],
    relevantProducts: CatalogProduct[],
    intent: AiIntent,
    recentContext: string,
    productContextInfo: string,
  ): string {
    const catalogSummary = relevantProducts;
    const budget = this.extractBudget(prompt);

    const catalogText = catalogSummary.length > 0 
      ? catalogSummary.map((product, index) => `${index + 1}. ${product.name} | gia: ${product.price} VND | danh muc: ${product.category ?? 'Chua ro'} | mo ta: ${product.description}`).join('\n')
      : 'HIỆN TẠI KHÔNG TÌM THẤY SẢN PHẨM PHÙ HỢP TRONG CATALOG CỦA ShopAI.';

    return [
      'Vai tro: Ban la tu van vien ban hang cua ShopAI.',
      'Muc tieu: tra loi huu ich, ngan gon, ro gia va cong dung, co the dua ra goi y mua hang.',
      `Intent du doan: ${intent}`,
      recentContext
        ? `Lịch sử hội thoại gần đây:\n${recentContext}`
        : 'Chưa có lịch sử hội thoại trước đó.',
      productContextInfo ? `Bối cảnh sản phẩm đang xem:\n${productContextInfo}` : '',
      budget
        ? `Ngan sach phat hien: ${budget} VND`
        : 'Khong phat hien ngan sach cu the.',
      'Day la catalog san pham hien co cua ShopAI de tham chieu:',
      catalogText,
      '',
      'Yeu cau tra loi:',
      '- Luon uu tien catalog thay vi tra loi chung chung.',
      '- Neu nguoi dung hoi gia, hay neu gia ro rang theo VND.',
      '- Neu nguoi dung hoi cong dung, hay tach thanh y chinh de de doc.',
      '- Neu nguoi dung hoi so sanh, hay so sanh theo gia, danh muc, cong dung va doi tuong phu hop.',
      '- Neu nguoi dung hoi goi y, hay chon 1-3 san pham phu hop nhat va noi ly do.',
      '- Cuoi cau tra loi, neu hop ngu canh, them 1 cau CTA nhe nhu goi y xem chi tiet hoac chon san pham phu hop.',
      '- Neu catalog khong du thong tin, phai noi ro khong thay du lieu.',
      '',
      `Cau hoi nguoi dung: ${prompt}`,
    ].join('\n');
  }

  private generateCatalogFallback(
    prompt: string,
    products: CatalogProduct[],
    relevantProducts: CatalogProduct[],
    intent: AiIntent,
  ): string {
    const selectedProducts =
      relevantProducts.length > 0 ? relevantProducts : products.slice(0, 5);
    const budget = this.extractBudget(prompt);

    if (selectedProducts.length === 0) {
      return 'Hien tai he thong chua co du lieu san pham de tu van.';
    }

    if (intent === 'comparison' && selectedProducts.length >= 2) {
      return selectedProducts
        .slice(0, 2)
        .map(
          (product, index) =>
            `${index + 1}. ${product.name}: gia ${product.price.toLocaleString('vi-VN')} VND, danh muc ${product.category ?? 'Chua ro'}, cong dung: ${product.description}`,
        )
        .concat(
          'Neu ban uu tien gia mem hon thi chon san pham co gia thap hon; neu uu tien dung mo ta phu hop nhu cau hon thi chon san pham co cong dung sat hon.',
        )
        .join('\n');
    }

    if (intent === 'price' && selectedProducts[0]) {
      const product = selectedProducts[0];
      return `${product.name} hien co gia ${product.price.toLocaleString('vi-VN')} VND. Danh muc: ${product.category ?? 'Chua ro'}. Cong dung/chuc nang: ${product.description}`;
    }

    if (intent === 'utility' && selectedProducts[0]) {
      const product = selectedProducts[0];
      return [
        `${product.name} co gia ${product.price.toLocaleString('vi-VN')} VND va thuoc danh muc ${product.category ?? 'Chua ro'}.`,
        `Cong dung/tinh nang chinh: ${product.description}`,
        'Neu ban muon, toi co the so sanh san pham nay voi san pham khac trong ShopAI.',
      ].join('\n');
    }

    if (intent === 'catalog' || intent === 'recommendation') {
      return [
        budget
          ? `ShopAI hien dang co cac san pham phu hop tam ngan sach ${budget.toLocaleString('vi-VN')} VND:`
          : 'ShopAI hien dang co cac san pham noi bat sau:',
        ...selectedProducts.map(
          (product) =>
            `- ${product.name}: gia ${product.price.toLocaleString('vi-VN')} VND, ${product.description}`,
        ),
        'Neu ban noi ro muc dich su dung hoac tam gia, toi co the goi y chinh xac hon.',
      ].join('\n');
    }

    const product = selectedProducts[0];
    return `${product.name} la mot san pham thuoc danh muc ${product.category ?? 'Chua ro'}, gia ${product.price.toLocaleString('vi-VN')} VND. Mo ta: ${product.description}`;
  }
}
