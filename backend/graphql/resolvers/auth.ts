import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma';
import { requireAuth, requireRole } from '../../auth/context';
import { sendOtpEmail } from '../../services/email';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    },
    staffMembers: async (_: any, __: any, context: any) => {
      const user = requireRole(context, 'owner');
      const staffMembers = await prisma.staffMember.findMany({
        where: { owner_id: user.id },
        include: {
          staff: {
            select: { id: true, email: true, display_name: true, role: true, status: true, created_at: true }
          }
        }
      });
      return staffMembers.map(sm => ({
        id: sm.staff.id,
        email: sm.staff.email,
        displayName: sm.staff.display_name,
        role: sm.staff.role,
        status: sm.staff.status,
        createdAt: sm.staff.created_at.toISOString()
      }));
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
        if (existing.status === 'pending') {
          const otp = generateOtp();
          const otpHash = await bcrypt.hash(otp, 10);
          const expiry = new Date(Date.now() + 15 * 60 * 1000);

          await prisma.user.update({
            where: { email },
            data: {
              password_hash: await bcrypt.hash(password, 10),
              display_name: displayName,
              otp_hash: otpHash,
              otp_expiry: expiry,
            }
          });

          await sendOtpEmail(email, otp).catch(() => {});

          return { email, message: 'An account with this email already exists but is pending verification. A new OTP has been sent.' };
        }
        throw new Error('Email already registered');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiry = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          display_name: displayName,
          role: 'owner',
          status: 'pending',
          otp_hash: otpHash,
          otp_expiry: expiry,
        }
      });

      await sendOtpEmail(email, otp).catch(() => {
        console.error('Failed to send OTP email to', email);
      });

      return { email, message: 'Account created! Check your email for the verification code.' };
    },
    resendOtp: async (_: any, { email }: any) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error('No account found with this email');
      }
      if (user.status !== 'pending') {
        throw new Error('Account is already verified');
      }

      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiry = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { email },
        data: { otp_hash: otpHash, otp_expiry: expiry }
      });

      await sendOtpEmail(email, otp).catch(() => {
        console.error('Failed to resend OTP email to', email);
      });

      return { message: 'A new verification code has been sent to your email.' };
    },
    verifyOtp: async (_: any, { email, otp }: any) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error('No account found with this email');
      }
      if (user.status !== 'pending') {
        throw new Error('Account is already verified');
      }
      if (!user.otp_hash || !user.otp_expiry) {
        throw new Error('No verification code found. Please request a new one.');
      }

      if (new Date() > user.otp_expiry) {
        throw new Error('Verification code has expired. Please request a new one.');
      }

      const valid = await bcrypt.compare(otp, user.otp_hash);
      if (!valid) {
        throw new Error('Invalid verification code');
      }

      await prisma.user.update({
        where: { email },
        data: { status: 'active', otp_hash: null, otp_expiry: null }
      });

      return { success: true, message: 'Email verified successfully! You can now log in.' };
    },
    createStaff: async (_: any, { email, password, displayName, role }: any, context: any) => {
      const user = requireRole(context, 'owner');

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
          role: role || 'cashier',
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
    updateStaffStatus: async (_: any, { id, status }: any, context: any) => {
      requireRole(context, 'owner');
      const updated = await prisma.user.update({
        where: { id },
        data: { status }
      });
      return {
        id: updated.id,
        email: updated.email,
        displayName: updated.display_name,
        role: updated.role,
        status: updated.status,
        createdAt: updated.created_at.toISOString()
      };
    },
    deleteStaff: async (_: any, { id }: any, context: any) => {
      const user = requireRole(context, 'owner');
      await prisma.staffMember.delete({ where: { staff_user_id: id } });
      await prisma.user.delete({ where: { id } });
      return true;
    },
    logout: async (_: any, __: any, context: any) => {
      return true;
    }
  }
};
