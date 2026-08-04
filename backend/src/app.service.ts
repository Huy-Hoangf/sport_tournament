import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'sport_tournament_backend',
      database: process.env.DB_NAME ? 'configured' : 'missing',
      timestamp: new Date().toISOString(),
    };
  }
}
