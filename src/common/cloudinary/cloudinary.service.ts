import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(
    fileStr: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'shopai_products',
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed with no result'));
          resolve(result);
        },
      );

      // Nếu là chuỗi data:image, bỏ phần prefix để lấy data base64 thuần túy
      const base64Data = fileStr.includes('base64,') 
        ? fileStr.split('base64,')[1] 
        : fileStr;
        
      streamifier.createReadStream(Buffer.from(base64Data, 'base64')).pipe(uploadStream);
    });
  }
}
