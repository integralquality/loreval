# Supabase Schema

## Auth

Supabase built-in auth. Start with Google OAuth, add GitHub/Discord later.

## Tables

### profiles

Extends `auth.users` with public display info.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'user_' || left(new.id::text, 8)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### levels

Core content table. Each row is one saved/shared level.

```sql
create table levels (
  id          uuid primary key default gen_random_uuid(),
  short_id    text unique not null,         -- 6-8 char ID for URLs (/play/abc123)
  author_id   uuid not null references profiles(id) on delete cascade,
  name        text not null,
  description text,
  dsl_code    text not null,                -- the full DSL source
  width       int not null,
  height      int not null,
  is_published boolean default false,       -- false = draft (only author sees), true = shared
  play_count  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index levels_author_id on levels(author_id);
create index levels_short_id on levels(short_id);
create index levels_published on levels(is_published) where is_published = true;
```

### level_stats

Per-user play results for a level.

```sql
create table level_stats (
  id          uuid primary key default gen_random_uuid(),
  level_id    uuid not null references levels(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  completed   boolean default false,
  steps       int,                          -- total moves to solve
  time_ms     int,                          -- solve time in milliseconds
  played_at   timestamptz default now(),

  unique(level_id, user_id)                 -- one best result per user per level
);
```

### level_likes

Simple like/favorite system.

```sql
create table level_likes (
  user_id     uuid not null references profiles(id) on delete cascade,
  level_id    uuid not null references levels(id) on delete cascade,
  created_at  timestamptz default now(),

  primary key (user_id, level_id)
);
```

## Row Level Security (RLS)

```sql
-- profiles: anyone can read, only owner can update
alter table profiles enable row level security;
create policy "Public profiles" on profiles for select using (true);
create policy "Own profile" on profiles for update using (auth.uid() = id);

-- levels: published are public, drafts only visible to author
alter table levels enable row level security;
create policy "Published levels are public" on levels for select
  using (is_published = true or auth.uid() = author_id);
create policy "Authors can insert" on levels for insert
  with check (auth.uid() = author_id);
create policy "Authors can update own" on levels for update
  using (auth.uid() = author_id);
create policy "Authors can delete own" on levels for delete
  using (auth.uid() = author_id);

-- level_stats: public reads, authenticated writes
alter table level_stats enable row level security;
create policy "Public stats" on level_stats for select using (true);
create policy "Auth users can insert" on level_stats for insert
  with check (auth.uid() = user_id);
create policy "Own stats update" on level_stats for update
  using (auth.uid() = user_id);

-- level_likes: public reads, own writes
alter table level_likes enable row level security;
create policy "Public likes" on level_likes for select using (true);
create policy "Auth users can like" on level_likes for insert
  with check (auth.uid() = user_id);
create policy "Own likes delete" on level_likes for delete
  using (auth.uid() = user_id);
```

## Views (for convenience)

```sql
-- Levels with author info and like count
create view levels_with_meta as
select
  l.*,
  p.username as author_name,
  p.avatar_url as author_avatar,
  coalesce(lk.like_count, 0) as like_count
from levels l
join profiles p on p.id = l.author_id
left join (
  select level_id, count(*) as like_count
  from level_likes group by level_id
) lk on lk.level_id = l.id
where l.is_published = true;
```

## Future Tables (not needed yet)

```
-- comments: feedback on shared levels
-- collections: curated level packs ("Boolean Logic 101", "Hard Mazes")
-- tags: categorization (difficulty, mechanics used, concepts taught)
-- follow: follow other designers
-- level_versions: version history / undo for drafts
-- reports: flag inappropriate content
```

## App Routes

```
/                     Home page
/designer             Level designer (new level)
/designer/:id         Edit own draft or published level
/play                 Campaign levels list
/play/:shortId        Play a shared level
/my-levels            User's drafts + published levels
/browse               Browse published levels (sort by new/popular/likes)
/profile/:username    Public profile + their published levels
/login                Auth page
```

## Short ID Generation

```typescript
// 8-char alphanumeric, collision-resistant
function generateShortId(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // no ambiguous chars (0/O, 1/l)
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
```
