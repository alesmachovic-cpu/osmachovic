create table analyzy_trhu (
  id uuid primary key default gen_random_uuid(),
  klient_id uuid references klienti(id) on delete set null,
  obec text not null,
  typ_nehnutelnosti text not null,
  plocha numeric not null,
  predajna_cena numeric,
  priemerna_cena_m2 numeric not null,
  odporucana_od numeric not null,
  odporucana_do numeric not null,
  hodnotenie text not null,
  odchylka_pct integer not null default 0,
  pocet_porovnani integer not null default 0,
  zdroj text not null,
  komentar text,
  analyzed_at timestamptz not null default now()
);

alter table analyzy_trhu enable row level security;
create policy "Service role full access" on analyzy_trhu for all using (true);

create index analyzy_trhu_klient_id_idx on analyzy_trhu(klient_id);
create index analyzy_trhu_analyzed_at_idx on analyzy_trhu(analyzed_at desc);
