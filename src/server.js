import 'dotenv/config';
import app from './app.js';
import pool from './database/pool.js';
import { config } from './config/env.js';

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

let shutdownPromise;

function shutdown(signal = 'requested') {
  if (shutdownPromise) return shutdownPromise;
  console.log(`Received ${signal}; shutting down`);

  shutdownPromise = new Promise((resolve) => {
    const forceClose = setTimeout(() => {
      console.error('Graceful shutdown timed out; closing active connections');
      server.closeAllConnections();
    }, 10000);
    forceClose.unref();

    server.close(async (error) => {
      clearTimeout(forceClose);
      if (error) {
        console.error('HTTP server shutdown failed:', error.message);
        process.exitCode = 1;
      }
      try {
        await pool.end();
      } catch (poolError) {
        console.error('Database pool shutdown failed:', poolError.message);
        process.exitCode = 1;
      }
      resolve();
    });
  });
  return shutdownPromise;
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

export { server, shutdown };
