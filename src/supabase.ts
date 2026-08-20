/**
 * Supabase 客户端（v2 云同步）
 *
 * 配置：项目根 `.env` 提供 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * （在 Supabase 控制台 → Project Settings → API 获取）。
 * 未配置时 isSupabaseConfigured=false，云同步功能自动隐藏，本地功能不受影响。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
