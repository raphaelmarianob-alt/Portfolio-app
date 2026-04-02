# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal family office app that automates stock portfolio reports. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Prisma 7 with SQLite.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build (uses Turbopack)
- `npm run lint` — run ESLint
- `npx prisma migrate dev --name <name>` — create and apply a migration
- `npx prisma generate` — regenerate Prisma client after schema changes
- `npx prisma studio` — open database GUI

## Architecture

### Database (Prisma + SQLite)

Schema in `prisma/schema.prisma`. Three tables:
- `research_base` — research data for each ticker (fundamentals, classification, recommendation)
- `relatorios` — client reports with metadata (objective, % PL, status)
- `relatorio_ativos` — line items in a report (current/suggested positions)

Prisma 7 uses the `@prisma/adapter-libsql` driver adapter. The client singleton is in `src/lib/prisma.ts`. Generated client output is at `src/generated/prisma/` — import from `@/generated/prisma/client`.

### API Routes (`src/app/api/`)

- `GET/POST /api/research` — list (with search/sort query params) and create assets
- `PATCH/DELETE /api/research/[id]` — update/delete a single asset
- `POST /api/research/upload` — CSV upload to bulk upsert research base (uses papaparse)
- `GET/POST /api/relatorios` — list and create reports (POST accepts nested `ativos`)
- `GET/DELETE /api/relatorios/[id]` — get/delete a report
- `POST /api/relatorios/[id]/ativos` — replace all positions for a report

### Pages (`src/app/`)

- `/base` — Research base management: inline-editable table, CSV upload, add modal, search, sortable columns, recommendation semaphore (green/yellow/gray/red)
- `/novo` — New report form: client name, % PL, objective dropdown, CSV or manual portfolio input with auto-enrichment from research base
- `/historico` — List of generated reports with expandable detail view

### Layout

Fixed sidebar (`src/components/Sidebar.tsx`) + top header. Sidebar: navy #1a2332, active link: #2e86de. White background, Inter font.

### Key Components (`src/components/`)

- `EditableCell` — click-to-edit cell supporting text, number, select, textarea modes
- `ResearchTable` — full research base table with sort, inline edit, expandable analysis row
- `AddAtivoModal` — form modal for adding a new asset
- `CsvUpload` — reusable file upload component for CSV ingestion

## Conventions

- All pages are client components (`"use client"`)
- API routes use `NextRequest`/`NextResponse` from `next/server`
- Dynamic route params are accessed via `params: Promise<{ id: string }>` (Next.js 16 pattern)
- CSS uses Tailwind v4 with `@import "tailwindcss"` syntax and `@theme inline` for CSS variables
- Portuguese (pt-BR) for all UI labels and messages
