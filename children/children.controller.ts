import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChildrenService } from './children.service';
import type { ChildResponse, UpdateChildBody } from './children.types';

@Controller('children')
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Patch(':id')
  updateChild(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: UpdateChildBody,
  ): Promise<ChildResponse> {
    return this.childrenService.updateChild(userId, id, body);
  }

  @Delete(':id')
  deleteChild(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.childrenService.deleteChild(userId, id);
  }
}
