# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**os-machovic** is a Next.js real estate CRM for Vianema real estate agency (Slovakia). It handles clients, properties, showings, commissions, invoices, and AI-powered document processing. All UI labels and domain terms are in Slovak.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

**Stack**: Next.js (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Supabase (PostgreSQL) + Anthropic Claude SDK + Google APIs

### Key Directories

- `src/app/` — App Router pages and API routes
- `src/app/api/` — Backend API routes (AI features, Google integrations, document parsing, invoices)
- `src/components/` — Reusable React components; large forms like `InzeratForm.tsx` (listings) and `NaberyForm.tsx` (acquisitions) live here
- `src/lib/` — Utilities: `supabase.ts` (singleton client), `database.types.ts` (all TypeScript DB types), `google.ts` (OAuth helpers), `featureToggles.ts`
- `src/hooks/` — Custom hooks (e.g. `useKoliziaCheck.ts` for property collision detection)
- `supabase/migrations/` — Database schema migrations

### Data Flow

1. **Auth**: `AuthProvider.tsx` context wraps the app; sessions persisted in localStorage
2. **Database**: All data access goes through Supabase client from `src/lib/supabase.ts`
3. **AI features**: API routes in `src/app/api/ai-writer/`, `ai-analyze/`, `ai-fill/` call Anthropic Claude (currently `gemini-2.5-flash` via Google for parse-doc) with `thinkingBudget: 0`
4. **Document parsing**: `parse-doc/` handles DOCX/PDF upload → AI extraction → structured JSON; PDFs are rasterized client-side before sending (Vercel 60s timeout constraint)
5. **Google integration**: OAuth flow in `api/auth/google/`; Drive, Gmail, and Calendar APIs in `api/google/` and `api/calendar/`

### UI Layout

- Desktop: `Sidebar.tsx` (left nav) + `Navbar.tsx` (top)
- Mobile: `BottomTabs.tsx` (bottom navigation)
- Dark mode supported via CSS variables in `globals.css`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # Server-side only
ANTHROPIC_API_KEY
GEMINI_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
MANAGER_EMAIL
```

## Domain Vocabulary (Slovak → English)

| Slovak | English |
|--------|---------|
| klient | client |
| nehnutelnost | property |
| naberovy list | acquisition/purchase list |
| inzerat | listing/ad |
| provizia | commission |
| faktura | invoice |
| makler | real estate agent/broker |
| odberatel | subscriber/buyer |
| znalecky posudok | property appraisal document |

## Important Constraints

- **Vercel Hobby plan**: 60s max for most routes; `parse-doc` is set to 300s (`maxDuration`). PDFs must be rasterized client-side before upload to avoid timeouts.
- **TypeScript path alias**: `@/*` maps to `./src/*`
- **Supabase client**: Always import from `src/lib/supabase.ts` (singleton proxy pattern, not direct instantiation)
