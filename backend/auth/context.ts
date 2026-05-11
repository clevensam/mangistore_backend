import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyToken, extractTokenFromHeader, AuthUser } from './jwt';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: SupabaseClient;

if (supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
} else {
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

export interface Context {
  user: AuthUser | null;
  supabase: SupabaseClient;
  res?: any;
}

export async function createContext(req: any, res?: any): Promise<Context> {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return { user: null, supabase, res };
  }

  try {
    const payload = verifyToken(token);
    const { data: user } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    return {
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        status: user.status
      } : null,
      supabase,
      res
    };
  } catch {
    return { user: null, supabase, res };
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