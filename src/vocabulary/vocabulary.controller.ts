import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ProgressService } from './progress/progress.service.js';
import { parse_submit_answer } from './progress/submit-answer.parse.js';
import type {
  SubmitAnswerResult,
  SummaryDto,
  TopicDetailDto,
  TopicSummaryDto,
} from './vocabulary.types.js';

@ApiTags('vocabulary')
@UseGuards(JwtAuthGuard)
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly progress: ProgressService) {}

  @Get('topics')
  @ApiOperation({ summary: 'List topics with per-topic progress counts' })
  list_topics(@CurrentUser() user: AuthUser): Promise<TopicSummaryDto[]> {
    return this.progress.list_topics(user.user_id);
  }

  @Get('topics/:topic_id')
  @ApiOperation({ summary: 'Get a topic with its words and word status' })
  get_topic(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
  ): Promise<TopicDetailDto> {
    return this.progress.get_topic(user.user_id, topic_id);
  }

  @Get('topics/:topic_id/review')
  @ApiOperation({ summary: 'Get a topic with only the words answered wrong' })
  get_review(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
  ): Promise<TopicDetailDto> {
    return this.progress.get_review(user.user_id, topic_id);
  }

  @Delete('topics/:topic_id/progress')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reset progress and answer logs of one topic' })
  async reset_topic(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
  ): Promise<void> {
    await this.progress.reset_topic(user.user_id, topic_id);
  }

  @Post('answers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit an answer, grade it and record progress' })
  submit_answer(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<SubmitAnswerResult> {
    return this.progress.submit_answer(user.user_id, parse_submit_answer(body));
  }

  @Get('summary')
  @ApiOperation({ summary: 'Overall learning summary across all topics' })
  summary(@CurrentUser() user: AuthUser): Promise<SummaryDto> {
    return this.progress.summary(user.user_id);
  }

  @Delete('progress')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Reset progress and answer logs (keeps grade cache)',
  })
  async reset(@CurrentUser() user: AuthUser): Promise<void> {
    await this.progress.reset(user.user_id);
  }
}
