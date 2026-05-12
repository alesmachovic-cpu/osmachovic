create table if not exists user_invites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  token text not null unique,
  created_by text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);
alter table user_invites enable row level security;
