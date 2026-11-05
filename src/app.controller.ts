import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly app_service: AppService) {}

  @Get()
  get_hello(): string {
    return this.app_service.get_hello();
  }

  // Public ping used by an external cron to wake the server on Render free tier.
  @Get('health')
  @ApiOperation({ summary: 'Health check / wake-up ping' })
  get_health(): { message: string } {
    return { message: 'ok' };
  }
}
