import { buildApp } from './app';

async function start() {
  const app = await buildApp();

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error, 'server_start_failed');
    process.exit(1);
  }
}

start();

