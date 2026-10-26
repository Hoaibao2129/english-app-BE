import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  get_hello(): string {
    return 'Hello World!';
  }
}
