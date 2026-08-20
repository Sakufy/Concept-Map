/**
 * 云同步服务（Supabase 官方标准用法照搬）：
 * - Auth：邮箱+密码 登录/注册/退出
 * - maps 表：整图 JSONB 存储，RLS 保证仅本人可读写
 * - 同步策略：单用户"最后写入优先 + updated_at 版本比对"
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { createEmptyDocument, type CmapDocument } from './types/cmap';
import type { CloudFolderMeta, CloudMapMeta, CloudUser } from './store/authStore';
import { translateAuthError } from './authErrors';

/** 云端未配置时统一抛出可读错误 */
function assertConfigured(): void {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('云端同步未配置：请在 .env 填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY');
  }
}

export async function signInWithEmail(email: string, password: string): Promise<CloudUser> {
  assertConfigured();
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error));
  if (!data.user) throw new Error('登录失败：未获取到用户信息');
  return { id: data.user.id, email: data.user.email ?? email };
}

export interface SignUpResult {
  user: CloudUser;
  /** 项目开启邮件确认时注册不会建立会话，需用户点击确认邮件后才能登录 */
  needConfirm: boolean;
}

export async function signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
  assertConfigured();
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) throw new Error(translateAuthError(error));
  if (!data.user) throw new Error('注册失败：未获取到用户信息');
  const user: CloudUser = { id: data.user.id, email: data.user.email ?? email };
  // 开启邮件确认时 data.session 为 null → 提示用户去收件箱确认，而非当作注册失败
  return { user, needConfirm: !data.session };
}

/** 重新发送注册确认邮件（Supabase 官方 resend API） */
export async function resendConfirmationEmail(email: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase!.auth.resend({ type: 'signup', email });
  if (error) throw new Error(translateAuthError(error));
}

export async function signOut(): Promise<void> {
  assertConfigured();
  const { error } = await supabase!.auth.signOut();
  if (error) throw new Error(translateAuthError(error));
}

interface MapRow {
  id: string;
  title: string;
  updated_at: string;
  folder_id: string | null;
}

export async function listCloudMaps(): Promise<CloudMapMeta[]> {
  assertConfigured();
  const { data, error } = await supabase!
    .from('maps')
    .select('id, title, updated_at, folder_id')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as MapRow[]).map((m) => ({
    id: m.id,
    title: m.title,
    updatedAt: m.updated_at,
    folderId: m.folder_id ?? null,
  }));
}

/** 新建云端地图（空文档），返回元信息 */
export async function createCloudMap(title: string, folderId: string | null = null): Promise<CloudMapMeta> {
  assertConfigured();
  const doc = createEmptyDocument(title);
  const { data, error } = await supabase!
    .from('maps')
    .insert({ title, data: doc as unknown as Record<string, unknown>, folder_id: folderId })
    .select('id, title, updated_at, folder_id')
    .single();
  if (error) throw new Error(error.message);
  const m = data as MapRow;
  return { id: m.id, title: m.title, updatedAt: m.updated_at, folderId: m.folder_id ?? null };
}

/** 加载云端地图整图数据 */
export async function loadCloudMap(id: string): Promise<CmapDocument> {
  assertConfigured();
  const { data, error } = await supabase!.from('maps').select('data').eq('id', id).single();
  if (error) throw new Error(error.message);
  return (data as { data: CmapDocument }).data;
}

/**
 * 保存整图到云端（最后写入优先）。
 * 若云端 updated_at 比本地传入的新，说明有更新的远端版本（并发），
 * 返回 conflict=true 供上层提示；本地保存仍执行。
 * 同时返回保存后云端最新的 updated_at（供上层更新本地版本号）。
 */
export async function saveMapToCloud(
  id: string,
  doc: CmapDocument,
  remoteUpdatedAt?: string,
): Promise<{ conflict: boolean; updatedAt: string }> {
  assertConfigured();
  const { data: row, error: fetchError } = await supabase!
    .from('maps')
    .select('updated_at')
    .eq('id', id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const conflict = Boolean(
    remoteUpdatedAt && row && new Date(row.updated_at).getTime() > new Date(remoteUpdatedAt).getTime(),
  );

  const { data, error } = await supabase!
    .from('maps')
    .update({ data: doc as unknown as Record<string, unknown>, title: doc.title })
    .eq('id', id)
    .select('updated_at')
    .single();
  if (error) throw new Error(error.message);
  return { conflict, updatedAt: (data as { updated_at: string }).updated_at };
}

export async function deleteCloudMap(id: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase!.from('maps').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// 云端文件夹（「我的地图」分组，单层结构；删除文件夹时地图移回根目录）
// ---------------------------------------------------------------------------

export async function listCloudFolders(): Promise<CloudFolderMeta[]> {
  assertConfigured();
  const { data, error } = await supabase!
    .from('folders')
    .select('id, name')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CloudFolderMeta[]).map((f) => ({ id: f.id, name: f.name }));
}

/** 新建云端文件夹（同名返回已存在的） */
export async function createCloudFolder(name: string): Promise<CloudFolderMeta> {
  assertConfigured();
  const trimmed = name.trim();
  const existing = await listCloudFolders();
  const dup = existing.find((f) => f.name === trimmed);
  if (dup) return dup;
  const { data, error } = await supabase!
    .from('folders')
    .insert({ name: trimmed || '新建文件夹' })
    .select('id, name')
    .single();
  if (error) throw new Error(error.message);
  return data as CloudFolderMeta;
}

/** 删除云端文件夹（文件夹内地图 folder_id 置空，不删除地图） */
export async function deleteCloudFolder(id: string): Promise<void> {
  assertConfigured();
  const { error: updateError } = await supabase!.from('maps').update({ folder_id: null }).eq('folder_id', id);
  if (updateError) throw new Error(updateError.message);
  const { error } = await supabase!.from('folders').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** 把某张云端地图移动到文件夹（null = 根目录） */
export async function setCloudMapFolder(mapId: string, folderId: string | null): Promise<void> {
  assertConfigured();
  const { error } = await supabase!.from('maps').update({ folder_id: folderId }).eq('id', mapId);
  if (error) throw new Error(error.message);
}
