import { supabase } from '../auth/context';
import { hashPassword, comparePassword } from '../auth/password';
import { createToken } from '../auth/jwt';
import type { AuthPayload, User } from '../types';

export class AuthService {
  async register(email: string, password: string, displayName: string): Promise<AuthPayload> {
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await hashPassword(password);

    const { data: user, error } = await supabase
      .from('admin_users')
      .insert([
        {
          email,
          password_hash: passwordHash,
          display_name: displayName,
          role: 'owner',
          status: 'active'
        }
      ])
      .select()
      .single();

    if (error || !user) {
      throw new Error(error?.message || 'Failed to create user');
    }

    return this.createAuthPayload(user);
  }

  async login(email: string, password: string): Promise<AuthPayload> {
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new Error('Account is inactive');
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    return this.createAuthPayload(user);
  }

  async createStaff(email: string, password: string, displayName: string, ownerId: string): Promise<User> {
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await hashPassword(password);

    const { data: user, error } = await supabase
      .from('admin_users')
      .insert([
        {
          email,
          password_hash: passwordHash,
          display_name: displayName,
          role: 'staff',
          status: 'active'
        }
      ])
      .select()
      .single();

    if (error || !user) {
      throw new Error(error?.message || 'Failed to create staff');
    }

    return user;
  }

  async findUserByEmail(email: string) {
    const { data } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();
    return data;
  }

  async getUserById(id: string) {
    const { data } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  private createAuthPayload(user: any): AuthPayload {
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      }
    };
  }
}

export const authService = new AuthService();