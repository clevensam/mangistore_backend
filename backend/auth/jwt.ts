import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  displayName: string;
  status: string;
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    throw new Error('Invalid or expired token');
  }
}

export function extractTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}