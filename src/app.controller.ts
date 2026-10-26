import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly app_service: AppService) {}

  @Get()
  get_hello(): string {
    return this.app_service.get_hello();
  }
}
