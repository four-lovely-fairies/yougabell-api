import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ChildResponseDto,
  CreateChildDto,
  UpdateChildDto,
} from './dto/child.dto';
import { ChildrenService } from './children.service';

@ApiTags('children')
@ApiBearerAuth()
@Controller('children')
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Post()
  @ApiOperation({ summary: '자녀 추가 (Figma 2395:9454)' })
  @ApiCreatedResponse({ type: ChildResponseDto })
  createChild(
    @CurrentUserId() userId: string,
    @Body() body: CreateChildDto,
  ): Promise<ChildResponseDto> {
    return this.childrenService.createChild(userId, body);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ChildResponseDto })
  updateChild(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: UpdateChildDto,
  ): Promise<ChildResponseDto> {
    return this.childrenService.updateChild(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  deleteChild(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.childrenService.deleteChild(userId, id);
  }
}
