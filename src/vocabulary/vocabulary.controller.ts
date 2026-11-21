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
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProgressService } from './progress/progress.service.js';
import {
  DIRECTIONS,
  DirectionSchema,
  OptionalDirectionSchema,
  SubmitAnswerDtoSchema,
} from './vocabulary.dto.js';
import type { Direction, SubmitAnswerDto } from './vocabulary.dto.js';
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
  listTopics(
    @CurrentUser() user: AuthUser,
    @Query('direction', new ZodValidationPipe(DirectionSchema))
    direction: Direction,
  ): Promise<TopicSummaryDto[]> {
    return this.progress.listTopics(user.user_id, direction);
  }

  @Get('topics/:topic_id')
  @ApiOperation({
    summary: 'Get a topic with its words and word status of one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  getTopic(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
    @Query('direction', new ZodValidationPipe(DirectionSchema))
    direction: Direction,
  ): Promise<TopicDetailDto> {
    return this.progress.getTopic(user.user_id, topic_id, direction);
  }

  @Get('topics/:topic_id/review')
  @ApiOperation({
    summary: 'Get a topic with only the words answered wrong in one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  getReview(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
    @Query('direction', new ZodValidationPipe(DirectionSchema))
    direction: Direction,
  ): Promise<TopicDetailDto> {
    return this.progress.getReview(user.user_id, topic_id, direction);
  }

  @Delete('topics/:topic_id/progress')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Reset progress and answer logs of one topic (one or both directions)',
  })
  @ApiQuery(OPTIONAL_DIRECTION_QUERY)
  async resetTopic(
    @CurrentUser() user: AuthUser,
    @Param('topic_id') topic_id: string,
    @Query('direction', new ZodValidationPipe(OptionalDirectionSchema))
    direction: Direction | null,
  ): Promise<void> {
    await this.progress.resetTopic(user.user_id, topic_id, direction);
  }

  @Post('answers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit an answer, grade it and record progress' })
  submitAnswer(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SubmitAnswerDtoSchema))
    dto: SubmitAnswerDto,
  ): Promise<SubmitAnswerResult> {
    return this.progress.submitAnswer(user.user_id, dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Overall learning summary across all topics for one direction',
  })
  @ApiQuery(DIRECTION_QUERY)
  summary(
    @CurrentUser() user: AuthUser,
    @Query('direction', new ZodValidationPipe(DirectionSchema))
    direction: Direction,
  ): Promise<SummaryDto> {
    return this.progress.summary(user.user_id, direction);
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
    @Query('direction', new ZodValidationPipe(OptionalDirectionSchema))
    direction: Direction | null,
  ): Promise<void> {
    await this.progress.reset(user.user_id, direction);
  }
}
