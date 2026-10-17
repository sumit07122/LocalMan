import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * Creates an RBAC guard requiring at least one of the specified roles.
 */
export function requireRoles(allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const hasRole = user.roles.some((role: string) => allowedRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenError(
        `Access restricted. Requires one of the following roles: ${allowedRoles.join(', ')}`
      );
    }
  };
}
