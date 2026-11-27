import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation.mts';

async function bootstrap() {
  const config = validateEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

void bootstrap().catch(() => {
  // El error de arranque es observable sin imprimir URI ni contraseñas.
  console.error('No se pudo iniciar el backend; compruebe configuración y servicios.');
  process.exitCode = 1;
});
