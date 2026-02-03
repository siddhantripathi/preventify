import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  getUserProfile,
  createOrUpdateUserOnLogin,
  updateUserProfile,
  setUserRole,
  listUsers
} from '../services/user.service';
import { USER_ROLES } from '@preventify/shared';

const loginBodySchema = z.object({
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  photoURL: z.string().url().nullable().optional()
});

const updateProfileBodySchema = z.object({
  displayName: z.string().nullable().optional(),
  photoURL: z.string().url().nullable().optional()
});

const setRoleBodySchema = z.object({
  role: z.enum(USER_ROLES)
});

export function registerAuthRoutes(app: FastifyInstance) {
  app.post(
    '/auth/login',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const body = loginBodySchema.parse(request.body);
      const user = request.user!;

      const profile = await createOrUpdateUserOnLogin(
        user.uid,
        body.email,
        body.displayName,
        body.photoURL ?? null
      );

      return reply.send({ user: profile });
    }
  );

  app.get(
    '/auth/me',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const user = request.user!;
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ user: profile });
    }
  );

  app.patch(
    '/auth/me',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const body = updateProfileBodySchema.parse(request.body);
      const user = request.user!;

      const profile = await updateUserProfile(user.uid, body);

      if (!profile) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ user: profile });
    }
  );

  app.get(
    '/admin/users',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (_request, reply) => {
      const users = await listUsers();
      return reply.send({ users });
    }
  );

  app.patch(
    '/admin/users/:uid/role',
    { preHandler: [verifyToken, requireRole('admin')] },
    async (request, reply) => {
      const { uid } = request.params as { uid: string };
      const body = setRoleBodySchema.parse(request.body);

      const existingUser = await getUserProfile(uid);
      if (!existingUser) {
        return reply.status(404).send({ error: 'User not found' });
      }

      await setUserRole(uid, body.role);
      const updatedUser = await getUserProfile(uid);

      return reply.send({ user: updatedUser });
    }
  );
}

