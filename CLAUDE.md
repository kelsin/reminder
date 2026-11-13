# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Discord reminder bot (the `/remind` slash command) running as a single Cloudflare Worker backed by a D1 (SQLite) database. Plain JavaScript ES modules: no build step, no TypeScript. User-facing behavior is documented in `README.md`; update it when command behavior changes.

## Commands

Package manager is pnpm (CI uses pnpm 9 on Node 22).

- `pnpm dev`: `wrangler dev --test-scheduled` on port 8787. The cron handler can be fired by hand at `http://localhost:8787/__scheduled`.
- `pnpm ngrok`: tunnels port 8787 so Discord can reach the local worker.
- `pnpm test:run`: single test run. `pnpm test` is watch mode outside CI. Coverage is always enabled by `vitest.config.js`.
- Single file or test: `pnpm vitest run src/discord.test.js -t "<test name>"`
- `pnpm lint` / `pnpm lint:fix`: ESLint.
- `pnpm pretty` / `pnpm pretty:fix`: Prettier over the whole repo, Markdown and JSON included. Prettier also sorts imports.
- `pnpm migrations:create <name>`, `pnpm migrations:list`, `pnpm migrations:apply`: D1 migrations in `migrations/`. Pass `--local` or `--remote` to choose the database.
- `pnpm deploy`: `wrangler deploy`.
- `node src/register.js`: registers the slash command schema with Discord globally. Needs `DISCORD_TOKEN` and `DISCORD_APPLICATION_ID` in the environment. There is no package script for it, and it must be re-run after any change to `COMMAND_REMIND` in `src/constants.js`.

CI (`.github/workflows/test.yml`) runs `pnpm commitlint -l`, `pnpm pretty`, `pnpm lint` and `pnpm test`. Commit messages must follow Conventional Commits. Lefthook runs commitlint on `commit-msg`, and Prettier, ESLint and `vitest related` on `pre-commit`.

## Configuration

The worker reads `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY` and `DISCORD_TOKEN` from `env`. None of them are in `wrangler.json`; local dev takes them from the gitignored `.dev.vars`. The D1 binding is `DB`.

## Architecture

`src/server.js` is the Worker entry point and exports `fetch` and `scheduled`.

- `fetch` is an itty-router `AutoRouter`. `POST /` is the Discord interactions endpoint: it verifies the ed25519 signature, answers `PING`, then dispatches on `interaction.data.options[0].name` to a handler in `src/discord.js`. A message-component interaction with `custom_id` `done` (the Done button on a reminder DM) goes to `discord.complete_reminder`. `verifyDiscordRequest` is called through the exported `server` object, so a test can replace it.
- `scheduled` runs on the `*/15 * * * *` cron and calls `discord.trigger_reminders(env)`, which selects every reminder with `ts <= unixepoch()`, DMs the user through the Discord REST API with the bot token, then deletes or reschedules the row.

Layering is `server.js` (routing, verification) → `discord.js` (command handlers, formatting, timezone resolution, Discord REST calls) → `db.js` (all SQL; every function takes the D1 binding as its first argument). `constants.js` holds the slash command schema, shared by `server.js` for subcommand names and by `register.js`.

### Data model

- `reminders(id, ts, user_id, message, config)`: `ts` is unix seconds. `config` is JSON text holding the `create` options left after `when` and `what` are removed: `{ reoccur, every?, unit?, times?, button? }`. `db.js` parses it on read and stringifies it on write. Defaults are applied where it is read (`every` 1, `unit` `"day"`, `times` 0), and `times` 0 means forever. A truthy `button` adds a Done button to the reminder DM.
- `timezones(discord_id, timezone)`: one table for server, channel and user overrides, keyed by the raw Discord ID with no scope column.

### Behavior that spans files

- Timezone precedence is user > channel > server > global (`America/Los_Angeles`). `interaction_ids()` builds the list in increasing priority, `db.get_timezones` returns one row per ID in that order, the global default is prepended, and the last row with a timezone wins.
- Reminders do not store a timezone. The resolved timezone is used only to interpret `when` at creation (`chrono-node` parse, then `dayjs(...).tz(tz, true)`) and to format output.
- Recurrence adds `every` × `unit` to the stored `ts`, not to the current time, and advances one interval per cron run. A recurring reminder is deleted when `times` is 1; `times` decrements only when greater than 1.
- `/remind delete <which>` and `/remind button <which>` take a 1-based index into `db.list_reminders` (the user's future reminders ordered by `ts`), not a database ID, so `list`, `delete` and `button` depend on the same query ordering.
- The Done button is stateless. `/remind button` only flips `config.button`; the click handler rewrites the DM from `interaction.message.content` as `✅ ~~<content>~~` with no database access, and nothing is kept about a reminder after it fires.
- Every slash command response is ephemeral (the `message()` helper), and reminders are always delivered as DMs.
- The user ID is `interaction.member.user.id` in a server and `interaction.user.id` in a DM; use `get_user_id()`.
- Timezone strings are stored without validation.

### Tests and lint

Tests are `src/discord.test.js`, `src/server.test.js` and `src/constants.test.js`; they stub `db.js` functions with `vi.spyOn` and Discord's REST API with a stubbed `fetch`. Vitest runs in its default Node environment with `dir: "src"`; no Workers pool or D1 mock is configured. ESLint is configured with browser globals only, so Node built-ins such as `process` must be imported explicitly (see `src/register.js`).
