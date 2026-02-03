import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './config';
import { initFirebase } from './firebase/admin';
import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';

export async function buildApp() {
  const app = Fastify({
    logger: true
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  initFirebase();

  app.addHook('onRequest', async (request) => {
    request.log.info(
      {
        method: request.method,
        url: request.url
      },
      'request_start'
    );
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'internal_error' : error.message
    });
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app);

  app.log.info(
    {
      env: env.APP_ENV
    },
    'app_initialized'
  );

  return app;
}

