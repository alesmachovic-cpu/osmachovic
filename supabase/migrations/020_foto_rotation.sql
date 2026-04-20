-- 020 — Automatická rotácia titulnej fotky každých 9 dní (SEO trick: oživenie inzerátu vo výpisoch portálov)

alter table nehnutelnosti
  add column if not exists last_foto_rotation_at timestamptz;

comment on column nehnutelnosti.last_foto_rotation_at is
  'Timestamp poslednej rotácie titulnej fotky (cron /api/cron/foto-rotation).';

create index if not exists idx_nehnutelnosti_foto_rotation
  on nehnutelnosti (status, last_foto_rotation_at)
  where status = 'aktivny';
