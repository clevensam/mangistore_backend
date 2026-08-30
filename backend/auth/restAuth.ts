// Authentication middleware for non-GraphQL (REST) routes.
// Mirrors the JWT verification used by the GraphQL context (`createContext`).

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

export interface RestAuthUser {
  id: string;
  email: string;
  role: string;
  displayName: string;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RestAuthUser;
    }
  }
}

export function authenticateRest(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/Bearer\s+(.+)/);
  const token = match ? match[1] : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // Verify signature + expiry only; profile rows are checked at call sites
    // that need them (db lookups are unnecessary for a stateless token check).
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).tokenUserId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
}
