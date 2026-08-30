import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../prisma', () => ({
  default: { user: { findUnique: vi.fn() }, staffMember: { findUnique: vi.fn() } },
}));

import { requireAuth, requireRole, getEffectiveOwnerId } from './context';

const USER = {
  id: 'u1',
  email: 'owner@test.com',
  role: 'owner',
  displayName: 'Owner',
  status: 'active',
};

describe('auth guards', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('requireAuth returns the user when present', () => {
    expect(requireAuth({ user: USER })).toBe(USER);
  });

  it('requireAuth throws when no user', () => {
    expect(() => requireAuth({ user: null })).toThrow('Authentication required');
  });

  it('requireRole passes for an allowed role', () => {
    expect(requireRole({ user: USER }, 'owner', 'manager')).toBe(USER);
  });

  it('requireRole throws when role not allowed', () => {
    expect(() => requireRole({ user: { ...USER, role: 'cashier' } }, 'owner')).toThrow(
      /Access denied/,
    );
  });

  it('requireRole throws when no user', () => {
    expect(() => requireRole({ user: null }, 'owner')).toThrow('Authentication required');
  });
});
