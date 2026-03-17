import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...result } = user.toObject();
    return result;
  }

  @Put('me')
  async updateProfile(@Request() req: any, @Body() updateData: any) {
    // Prevent updating sensitive fields via this endpoint
    const { email, password, role, ...safeData } = updateData;
    
    const updatedUser = await this.usersService.update(req.user.userId, safeData);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    const { password: pw, ...result } = updatedUser.toObject();
    return result;
  }
}
