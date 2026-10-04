/**
 * Entry point do servidor.
 *
 * Responsabilidades: validar ambiente (via config/env), conectar no banco,
 * sincronizar o schema, subir o HTTP e encerrar de forma graciosa.
 */
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { syncDatabase } from './migrations/sync.js';

async function bootstrap(): Promise<void> {
  // `sync()` falha em produção; ver migrations/sync.ts.
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Use migrações versionadas em produção (NODE_ENV=production não executa sync).',
    );
  }

  await connectDatabase();
  await syncDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`API do Goal Tracker rodando em http://localhost:${env.PORT}`);
    console.log(`Ambiente: ${env.NODE_ENV}`);
  });

  // Encerramento gracioso: para de aceitar conexões novas, espera as que estão
  // em andamento e só então fecha o pool do banco.
  const shutdown = (signal: string) => {
    console.log(`\n${signal} recebido, encerrando...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    // Se algo travar, não ficamos pendurados para sempre.
    setTimeout(() => {
      console.error('Encerramento forçado após timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar o servidor:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});