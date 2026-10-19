import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/app-error.js';
import { prisma } from '../../config/database.js';

export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  roles: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; phoneNumber?: string; roles?: string[]; type?: string; jti?: string };
    user: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ userId: string; phoneNumber: string }>();
    if (!payload?.userId) {
      throw new UnauthorizedError('Invalid authorization token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        userRoles: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or suspended');
    }

    request.user = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      roles: user.userRoles.map((ur) => ur.roleId),
    };
  } catch {
    throw new UnauthorizedError('Authentication token missing or invalid');
  }
}
