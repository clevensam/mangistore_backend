import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma';
import { requireAuth } from '../../auth/context';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export const authResolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) return null;

      const profile = await prisma.user.findUnique({
        where: { id: context.user.id }
      });

      if (!profile) return null;

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        role: profile.role,
        status: profile.status,
        createdAt: profile.created_at.toISOString()
      };
    }
  },
  Mutation: {
    login: async (_: any, { email, password }: any) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }

      if (user.status !== 'active') {
        throw new Error('Account is inactive');
      }

      const token = generateToken(user.id);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          status: user.status,
          createdAt: user.created_at.toISOString()
        }
      };
    },
    register: async (_: any, { email, password, displayName }: any) => {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error('Email already registered');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const profile = await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          display_name: displayName,
          role: 'owner',
          status: 'active'
        }
      });

      const token = generateToken(profile.id);

      return {
        token,
        user: {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          role: profile.role,
          status: profile.status,
          createdAt: profile.created_at.toISOString()
        }
      };
    },
    createStaff: async (_: any, { email, password, displayName }: any, context: any) => {
      const user = requireAuth(context);
      if (user.role !== 'owner') {
        throw new Error('Only owners can create staff accounts');
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error('Email already registered');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const staff = await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          display_name: displayName,
          role: 'staff',
          status: 'active'
        }
      });

      await prisma.staffMember.create({
        data: {
          owner_id: user.id,
          staff_user_id: staff.id
        }
      });

      return {
        id: staff.id,
        email: staff.email,
        displayName: staff.display_name,
        role: staff.role,
        status: staff.status,
        createdAt: staff.created_at.toISOString()
      };
    },
    logout: async (_: any, __: any, context: any) => {
      return true;
    }
  }
};
