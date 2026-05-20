-- Migration: Add OTP verification columns to profiles table
-- Run this against your Railway MySQL database

ALTER TABLE profiles
  ADD COLUMN otp_hash VARCHAR(191) NULL AFTER status,
  ADD COLUMN otp_expiry DATETIME(3) NULL AFTER otp_hash;

-- Existing users remain 'active'; new users get 'pending' via Prisma schema default
