# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Self-contained, Spanish-language interactive study guides for AWS certification exams
(currently AI Practitioner AIF-C01 and Cloud Practitioner CLF-C02). There is no build system, no
package manager, and no test suite. The app logic/styles are shared across all exams; only exam
content differs per exam.

## Commands

- Run locally: `node server.js`, then open `http://localhost:8787` (port via `PORT` env var).
  `server.js` is a dependency-free static file server that serves any file in the repo by path,
  falling back to `<path>.html` for extensionless URLs (mirrors Cloudflare Pages' clean-URL
  behavior in production). It has no API routes.
- No install step, no build step, no linter, no test suite exist in this repo.

## Architecture

**One shared engine, one folder of data per exam.** Each exam is a thin HTML shell at the repo
root (`guia-ai-practitioner.html`, `guia-cloud-practitioner.html`) that:
1. Links `shared/styles.css` and loads the Supabase CDN script.
2. Defines `window.EXAM_META` inline (`id`, `slug`, `codigo`, `nombre`, `nombreCompleto`,
   `comparadorTitulo`, `comparadorTabLabel`) — this is the only per-exam configuration in the shell.
3. Loads `exams/<exam-id>/data.js` — the exam's content as plain JS globals (`DOMINIOS`,
   `PREGUNTAS`, `CASOS`, `CONFUSIBLES`, `PREGUNTAS_SERVICIOS`, `FLASHCARDS`, `GLOSARIO`,
   `SERVICIOS`), same shape for every exam.
4. Loads `shared/app.js` — all app logic (auth, progress sync, tab rendering, quiz/exam engine).
   This file is identical across exams and must stay that way; it reads `EXAM_META` and the exam
   content globals rather than hardcoding exam-specific text.

`index.html` is a lightweight exam picker (does not load `shared/app.js` or Supabase) linking to
`/guia-ai-practitioner` and `/guia-cloud-practitioner`.

To add a new exam: create `exams/<id>/data.js` in the same shape, copy an existing `guia-*.html`
and change its `EXAM_META`, and add an entry to the `EXAMENES` registry near the bottom of
`shared/app.js` (this is what powers the "cambiar examen" header button — it is a static array,
not derived from the filesystem, since this is a static site with no directory listing).

**Tabs are client-side views, not routes.** Each `<button data-tab="...">` in `#tabs` maps to a
`render*()` function (e.g. `renderInicio()`, `renderPreguntas()`) in `shared/app.js` that fills the
matching `#panel-*` section. Switching tabs just toggles `.active` and calls the render function —
there's no router.

**Auth: Supabase (email OTP, not magic link).** `supabaseClient` is created near the top of
`shared/app.js` with `SUPABASE_URL`/`SUPABASE_ANON_KEY` (the publishable/anon key — safe to expose
client-side; access is enforced entirely by Postgres Row Level Security policies, not by hiding
this key). Login flow is two steps in one tab: `supabaseClient.auth.signInWithOtp({email})` sends
a code, then `supabaseClient.auth.verifyOtp({email, token, type:"email"})` verifies it — deliberately
not the magic-link redirect flow, to avoid opening a second tab. Do not rename the `supabaseClient`
variable to `supabase` — the Supabase CDN bundle already defines a global `window.supabase`, and
`const supabase = ...` collides with it (`SyntaxError: Identifier 'supabase' has already been
declared`). Users can dismiss the auth overlay ("Seguir sin cuenta") and use the app fully with
progress kept only in `localStorage`.

**Progress storage: dual-layer, Supabase + localStorage, scoped per exam.** Progress lives in
memory/localStorage as `progreso[qid] = {intentos, correctas, ultima, racha}`, under the
per-exam key `` `guia_progress_v1_${EXAM_META.id}` `` — so switching exams in the same browser
never mixes progress. When signed in, `pullProgreso()`/`pushProgreso()` sync that object against
the Supabase table `public.progreso` (one row per `user_id, examen, qid`, RLS-scoped to
`auth.uid() = user_id`, `examen` filtered/set to `EXAM_META.id`) via `.select()` and
`.upsert(rows, {onConflict:"user_id,examen,qid"})`. `sincronizarProgreso()` runs automatically on
an interval but must only re-render the active question panel on a *manual* sync
(`sincronizarProgreso(true)`) — re-rendering on the background interval resets in-progress
"ordenar"/"emparejar" question `<select>` state. `reiniciarProgreso()` is async and must delete
both local state and the user's remote rows for the current exam only
(`.delete().eq("user_id", usuarioActual).eq("examen", EXAM_META.id)`).

**Exam content is data, not markup.** Domain review text, questions, flashcards, glossary, and the
AWS services table all live in `exams/<id>/data.js` as plain JS arrays/objects (see `DOMINIOS` for
the domain/task breakdown — weights vary per exam, e.g. AIF-C01 is 20/24/28/14/14% across 5
domains, CLF-C02 is 24/30/34/12% across 4). Content edits (fixing a question, adding a service)
mean editing the exam's `data.js` directly, not `shared/app.js`. `exams/cloud-practitioner/data.js`
currently only has the official domain/task skeleton filled in — questions, flashcards, glossary,
services, and the comparator are still empty and need to be authored.

**Deployment: static hosting, no server required in production.** The app has no server-side state
beyond serving files, so it's designed for Cloudflare Pages, which serves `/` as `index.html` and
exposes every `guia-*.html` at its extensionless path automatically. Do not add a `_redirects`
file duplicating this — a rewrite rule for `/guia-x` → `/guia-x.html` fights with Cloudflare's own
built-in clean-URL canonicalization and causes an `ERR_TOO_MANY_REDIRECTS` loop in production.
`server.js` mirrors the same extensionless-fallback behavior for local development or a Node-based
host — it's optional in production. See `README.md` ("Desplegar en Cloudflare Pages")
for the full deploy/DNS/Supabase-redirect-URL/Resend-domain checklist.
