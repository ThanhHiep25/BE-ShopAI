import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Request() req: any) {
    return this.notificationsService.findByUser(req.user.userId);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete('clear')
  async clearAll(@Request() req: any) {
    await this.notificationsService.clearAll(req.user.userId);
    return { message: 'All notifications cleared' };
  }
}
