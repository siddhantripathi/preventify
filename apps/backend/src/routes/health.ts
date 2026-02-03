import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { initFirebase } from '../firebase/admin';

export function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal('ok')
          })
        }
      }
    },
    async () => {
      const firestore = initFirebase();
      await firestore.listCollections();
      return { status: 'ok' };
    }
  );
}

