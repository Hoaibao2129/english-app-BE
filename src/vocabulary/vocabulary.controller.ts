import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ProgressService } from './progress/progress.service.js';
import { parse_submit_answer } from './progress/submit-answer.parse.js';
import {
  DIRECTIONS,
  parse_direction,
  parse_optional_direction,
} from './progress/direction.parse.js';
import type {
  SubmitAnswerResult,
  SummaryDto,
  TopicDetailDto,
  TopicSummaryDto,
} from './vocabulary.types.js';

const DIRECTION_QUERY = {
  name: 'direction',
  enum: DIRECTIONS,
  required: true,
} as const;
const OPTIONAL_DIRECTION_QUERY = {
  ...DIRECTION_QUERY,
  required: false,
  description: 'Omit to reset both directions',
} as const;

@ApiTags('vocabulary')
@UseGuards(JwtAuthGuard)
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly progress: ProgressService) {}

  @Get('topics')
  @ApiOperation({
    summary: 'List topics with per-topic progress counts of one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  list_topics(
    @CurrentUser() user: AuthUser,
    @Query('direction') direction: unknown,
  ): Promise<TopicSummaryDto[]> {
    return this.progress.list_topics(user.user_id, parse_direction(direction));
  }

  @Get('topics/:topic_id')
  @ApiOperation({
    summary: 'Get a topic with its words and word status of one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  get_topic(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
    @Query('direction') direction: unknown,
  ): Promise<TopicDetailDto> {
    return this.progress.get_topic(
      user.user_id,
      topic_id,
      parse_direction(direction),
    );
  }

  @Get('topics/:topic_id/review')
  @ApiOperation({
    summary: 'Get a topic with only the words answered wrong in one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  get_review(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
    @Query('direction') direction: unknown,
  ): Promise<TopicDetailDto> {
    return this.progress.get_review(
      user.user_id,
      topic_id,
      parse_direction(direction),
    );
  }

  @Delete('topics/:topic_id/progress')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Reset progress and answer logs of one topic (one or both directions)',
  })
  @ApiQuery(OPTIONAL_DIRECTION_QUERY)
  async reset_topic(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
    @Query('direction') direction: unknown,
  ): Promise<void> {
    await this.progress.reset_topic(
      user.user_id,
      topic_id,
      parse_optional_direction(direction),
    );
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
  @ApiOperation({
    summary: 'Overall learning summary across all topics for one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  summary(
    @CurrentUser() user: AuthUser,
    @Query('direction') direction: unknown,
  ): Promise<SummaryDto> {
    return this.progress.summary(user.user_id, parse_direction(direction));
  }

  @Delete('progress')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Reset progress and answer logs of one or both directions (keeps grade cache)',
  })
  @ApiQuery(OPTIONAL_DIRECTION_QUERY)
  async reset(
    @CurrentUser() user: AuthUser,
    @Query('direction') direction: unknown,
  ): Promise<void> {
    await this.progress.reset(
      user.user_id,
      parse_optional_direction(direction),
    );
  }
}
