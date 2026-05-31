# Fund Analysis Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fund analysis website with separated React frontend, FastAPI backend, Supabase persistence/auth, AKShare sync entrypoint, and deployable Vercel/Render configuration.

**Architecture:** The frontend runs as a Vite app under `apps/web` and calls HTTP APIs exposed by `apps/api`. The backend owns data sync, metric calculation, and user data APIs, with local seed data as the default development fallback and Supabase as the production store.

**Tech Stack:** React, Vite, TypeScript, TanStack Query, React Router, Recharts, FastAPI, Pydantic, Supabase Postgres/Auth, AKShare, Vercel, Render.

---

## Tasks

- [x] Create feature branch and inspect existing files.
- [x] Add backend tests for metric calculations and API behavior.
- [x] Implement FastAPI app, seed data, metrics service, route layer, sync entrypoint, and Supabase schema.
- [x] Implement React/Vite pages for dashboard, fund detail, comparison, and Google auth entry.
- [x] Add deployment configuration and documentation.

## Verification

- Run backend tests with `pytest -q` after installing `apps/api` dev dependencies.
- Run frontend build with `npm install && npm run build:web` after installing Node/npm.
- Manually verify local UI at `http://localhost:5173` and API at `http://localhost:8000`.
