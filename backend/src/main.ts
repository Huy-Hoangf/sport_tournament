import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function readAllowedOrigins(): CorsOptions['origin'] {
  const origins = process.env.FRONTEND_URL?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (origin, callback) => {
    if (
      !origin ||
      origins?.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:')
    ) {
      callback(null, true);
      return;
    }

    callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: readAllowedOrigins(),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
