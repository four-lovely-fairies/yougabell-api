import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SatisfactionSurveyPromptStateDto,
  SatisfactionSurveyResponseDto,
  SatisfactionSurveyStatusDto,
  SubmitSatisfactionSurveyDto,
} from './dto/satisfaction-survey.dto';
import { SurveysService } from './surveys.service';

@ApiTags('surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('surveys/satisfaction')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get('status')
  @ApiOkResponse({ type: SatisfactionSurveyStatusDto })
  getStatus(@CurrentUserId() userId: string) {
    return this.surveysService.getSatisfactionStatus(userId);
  }

  @Post('prompt-shown')
  @ApiOkResponse({ type: SatisfactionSurveyPromptStateDto })
  recordPromptShown(@CurrentUserId() userId: string) {
    return this.surveysService.recordSatisfactionPromptShown(userId);
  }

  @Post('prompt-dismissed')
  @ApiOkResponse({ type: SatisfactionSurveyPromptStateDto })
  recordPromptDismissed(@CurrentUserId() userId: string) {
    return this.surveysService.recordSatisfactionPromptDismissed(userId);
  }

  @Post('responses')
  @ApiOkResponse({ type: SatisfactionSurveyResponseDto })
  submit(
    @CurrentUserId() userId: string,
    @Body() body: SubmitSatisfactionSurveyDto,
  ) {
    return this.surveysService.submitSatisfactionSurvey(userId, body);
  }
}
