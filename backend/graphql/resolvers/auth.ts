import { authService } from '../../services/authService';

export const authResolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        return null;
      }
      const dbUser = await authService.getUserById(context.user.id);
      if (!dbUser) return null;
      return {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.display_name,
        role: dbUser.role,
        status: dbUser.status,
        createdAt: dbUser.created_at
      };
    }
  },
  Mutation: {
    login: async (_: any, { email, password }: any, context: any) => {
      const result = await authService.login(email, password);
      if (context.res && result.token) {
        context.res.cookie('auth_token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });
      }
      return result;
    },
    register: async (_: any, { email, password, displayName }: any, context: any) => {
      const result = await authService.register(email, password, displayName);
      if (context.res && result.token) {
        context.res.cookie('auth_token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });
      }
      return result;
    },
    createStaff: async (_: any, { email, password, displayName }: any, context: any) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (context.user.role !== 'owner') {
        throw new Error('Only owners can create staff accounts');
      }
      const staff = await authService.createStaff(email, password, displayName, context.user.id);
      return {
        id: staff.id,
        email: staff.email,
        displayName: staff.display_name,
        role: staff.role,
        status: staff.status,
        createdAt: staff.created_at
      };
    },
    logout: async (_: any, __: any, context: any) => {
      if (context.res) {
        context.res.clearCookie('auth_token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      }
      return true;
    }
  }
};