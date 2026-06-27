import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0'); // 0.0.0.0 供容器/Fly 接收外部流量；本地 localhost 同样可达
  // eslint-disable-next-line no-console
  console.log(`[LinkU] backend listening on http://localhost:${port}  (providers: auth=${process.env.AUTH_PROVIDER} media=${process.env.MEDIA_PROVIDER} translation=${process.env.TRANSLATION_PROVIDER} payment=${process.env.PAYMENT_PROVIDER})`);
}
bootstrap();
