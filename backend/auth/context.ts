import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  displayName: string;
  status: string;
}

export interface Context {
  user: AuthUser | null;
  res?: any;
}

function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/Bearer\s+(.+)/);
  return match ? match[1] : null;
}

export async function createContext(req: any, res?: any): Promise<Context> {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return { user: null, res };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, display_name: true, role: true, status: true }
    });

    if (!user) {
      return { user: null, res };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        status: user.status
      },
      res
    };
  } catch {
    return { user: null, res };
  }
}

export function requireAuth(context: Context): AuthUser {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  return context.user;
}

export function requireOwner(context: Context): AuthUser {
  const user = requireAuth(context);
  if (user.role !== 'owner') {
    throw new Error('Owner access required');
  }
  return user;
}
