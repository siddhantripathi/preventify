import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserRole } from '@preventify/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: DecodedIdToken & { role?: UserRole };
  }
}

export async function verifyToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    request.user = decoded as DecodedIdToken & { role?: UserRole };
  } catch (error) {
    request.log.warn({ error }, 'token_verification_failed');
    reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const userRole = request.user.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}

