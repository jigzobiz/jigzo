# JIGZO — Project Source of Truth

This repository is edited by more than one AI tool (Claude Code and Antigravity).
Read this before running, previewing, or editing anything.

## The active application

- **Active app:** `frontend/`
- **Framework:** React + Vite
- **Entry point:** `frontend/src/main.jsx`
- **Active HTML shell:** `frontend/index.html`
- **Pages:** `frontend/src/pages/` (LandingPage, CreatePage, ReceivePage, TermsPage, AdminPortal)
- **Backend/API:** `backend/src/server.js` (Express, mounted at `/api` and `/uploads`)

## Correct commands

Dev server (React/Vite):

```
cd frontend
npm run dev
```

Production build:

```
cd frontend
npm run build
```

Vite normally serves on **http://localhost:5173** (use the actual port Vite prints if 5173 is taken).

## Hard rules

- **Never** use root standalone HTML as the app.
- **Never** use Live Server for the application.
- **Never** use `localhost:5501` or any root static server (the old `serve.ps1` has been removed).
- **Never** recreate deleted legacy pages (`index.html`, `create.html`, `receive.html`, `terms.html` at the repo root, or root `css/` and `js/`).
- **Never** restore the four obsolete hero files: `desktop-hero-clean.jpg`, `desktop-hero.png`, `mobile-hero-clean.jpg`, `mobile-hero.png`.
- Production deploys **only** through reviewed GitHub commits and Vercel (`vercel.json` builds `backend/src/server.js` + `frontend/`).
- **Never** run `npx vercel --prod`.
- `CHECKOUT_ENABLED` must remain **false**.
- `WHATSAPP_ENABLED` must remain **false**.

## Shared-tool discipline

- **One editing agent at a time.** Do not let Claude Code and Antigravity edit the same branch simultaneously.
- Both tools must run `git status` and inspect the working tree **before** editing.
- A file, preview, or launch config is **not** authoritative just because it renders in a browser. The source of truth is the Vite build of `frontend/`, the React Router routes in `frontend/src/main.jsx`, `vercel.json`, and the backend server config.

## Routing note

The receiver route is `/p/:publicId`. A `/receive.html` SPA route is intentionally
**retained** because `frontend/src/services/api.js` uses it as the local-test
checkout redirect target. It maps to `ReceivePage` inside the React app — it does
**not** serve any old static page.
