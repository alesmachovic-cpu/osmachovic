-- ============================================================
-- 067: firma_info — centrálne firemné údaje pre právne stránky
-- ============================================================

create table if not exists firma_info (
  id             integer primary key default 1,
  nazov          text not null default 'Vianema s. r. o.',
  sidlo          text not null default 'Karpatské námestie 10A, 831 06 Bratislava — mestská časť Rača',
  ico            text not null default '47395095',
  dic            text not null default '2023848508',
  ic_dph         text not null default 'SK2023848508',
  registracia    text not null default 'Mestského súdu Bratislava III, oddiel Sro, vložka č. 123596/B',
  konatel        text not null default 'Aleš Machovič',
  telefon        text not null default '',
  email          text not null default 'info@vianema.sk',
  web            text not null default 'vianema.sk',
  prevadzkarena  text not null default '',
  region         text not null default '',
  historia       text not null default '',
  cislo_licencie text not null default '',
  poistovna      text not null default '',
  narks          text not null default '',
  updated_at     timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Seed: jeden riadok s predvyplnenými hodnotami
insert into firma_info (id) values (1) on conflict (id) do nothing;

-- RLS
alter table firma_info enable row level security;

-- Čítanie: verejné (legal pages bez prihlásenia)
create policy "firma_info_select_public"
  on firma_info for select using (true);

-- Zápis: len prihlásení (server-side cez service role to obchádza — OK)
create policy "firma_info_update_auth"
  on firma_info for update using (auth.role() = 'authenticated');
