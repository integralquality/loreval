import { supabase } from './supabase';
import type { Level } from '../types';
import { serializeDSL } from '../dsl/serializer';
import { parseDSL } from '../dsl/parser';

// ── Types ────────────────────────────────────────────────────

export interface LevelRow {
  id: string;
  short_id: string;
  author_id: string;
  name: string;
  description: string | null;
  dsl_code: string;
  width: number;
  height: number;
  is_published: boolean;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export interface LevelWithMeta extends LevelRow {
  author_name: string;
  author_avatar: string | null;
  like_count: number;
  liked_by_me?: boolean;
}

// ── Short ID ─────────────────────────────────────────────────

function generateShortId(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ── CRUD ─────────────────────────────────────────────────────

export async function saveLevel(
  level: Level,
  name: string,
  dslCode: string,
  levelId?: string
): Promise<{ id: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: '', error: 'Not authenticated' };

  const payload = {
    name,
    dsl_code: dslCode,
    width: level.width,
    height: level.height,
    updated_at: new Date().toISOString(),
  };

  if (levelId) {
    // Update existing
    const { error } = await supabase
      .from('levels')
      .update(payload)
      .eq('id', levelId)
      .eq('author_id', user.id);
    if (error) return { id: '', error: error.message };
    return { id: levelId };
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('levels')
      .insert({
        ...payload,
        short_id: generateShortId(),
        author_id: user.id,
      })
      .select('id')
      .single();
    if (error) return { id: '', error: error.message };
    return { id: data.id };
  }
}

export async function publishLevel(id: string): Promise<{ shortId: string; error?: string }> {
  const { data, error } = await supabase
    .from('levels')
    .update({ is_published: true })
    .eq('id', id)
    .select('short_id')
    .single();
  if (error) return { shortId: '', error: error.message };
  return { shortId: data.short_id };
}

export async function unpublishLevel(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('levels')
    .update({ is_published: false })
    .eq('id', id);
  return { error: error?.message };
}

export async function getMyLevels(): Promise<LevelRow[]> {
  const { data } = await supabase
    .from('levels')
    .select('*')
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export async function getPublishedLevels(
  sort: 'newest' | 'most_played' | 'most_liked' = 'newest',
  page = 0,
  pageSize = 20
): Promise<LevelWithMeta[]> {
  // Use the view for published levels with author info and like counts
  let query = supabase
    .from('levels_with_meta')
    .select('*')
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (sort === 'newest') query = query.order('created_at', { ascending: false });
  else if (sort === 'most_played') query = query.order('play_count', { ascending: false });
  else if (sort === 'most_liked') query = query.order('like_count', { ascending: false });

  const { data } = await query;
  return (data ?? []) as LevelWithMeta[];
}

export async function getLevelByShortId(shortId: string): Promise<LevelWithMeta | null> {
  // Fetch level with author info
  const { data: level } = await supabase
    .from('levels')
    .select('*, profiles!levels_author_id_fkey(username, avatar_url)')
    .eq('short_id', shortId)
    .single();

  if (!level) return null;

  // Increment play count (fire and forget)
  supabase
    .from('levels')
    .update({ play_count: (level.play_count || 0) + 1 })
    .eq('id', level.id)
    .then(() => {});

  // Get like count
  const { count } = await supabase
    .from('level_likes')
    .select('*', { count: 'exact', head: true })
    .eq('level_id', level.id);

  const profile = level.profiles as { username: string; avatar_url: string | null } | null;

  return {
    ...level,
    profiles: undefined,
    author_name: profile?.username ?? 'Unknown',
    author_avatar: profile?.avatar_url ?? null,
    like_count: count ?? 0,
  } as LevelWithMeta;
}

export async function getLevelById(id: string): Promise<LevelRow | null> {
  const { data } = await supabase
    .from('levels')
    .select('*')
    .eq('id', id)
    .single();
  return data;
}

export async function deleteLevel(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('levels').delete().eq('id', id);
  return { error: error?.message };
}

export async function toggleLike(levelId: string): Promise<{ liked: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { liked: false, error: 'Not authenticated' };

  // Check if already liked
  const { data: existing } = await supabase
    .from('level_likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('level_id', levelId)
    .single();

  if (existing) {
    await supabase
      .from('level_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('level_id', levelId);
    return { liked: false };
  } else {
    await supabase
      .from('level_likes')
      .insert({ user_id: user.id, level_id: levelId });
    return { liked: true };
  }
}

// ── Helpers ──────────────────────────────────────────────────

/** Parse a level's DSL code into a Level object */
export function parseLevelDSL(dslCode: string): Level | null {
  const result = parseDSL(dslCode);
  return result.level;
}

/** Serialize a Level object to DSL code */
export function levelToDSL(level: Level): string {
  return serializeDSL(level);
}
