# Reminder Done Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reminder DMs can carry an optional Done button that, when clicked, rewrites that DM as done; the option is set on create and toggled on scheduled reminders with `/remind button <which>`.

**Architecture:** The option is a boolean `button` key in the reminder's existing `config` JSON. The cron attaches a button component to the DM when it is set. The click is stateless: the server answers the message-component interaction with an update built from the message content Discord sends with the click. No database access on click, no migration.

**Tech Stack:** Cloudflare Worker (plain JS, ES modules), D1, `discord-interactions` 4.x, `itty-router`, `dayjs`, vitest 2.

**Spec:** `docs/superpowers/specs/2026-11-13-reminder-done-button-design.md`

## Global Constraints

- Config key is `button` (boolean). Missing or `false` means off. No migration; nothing is stored about a reminder after it fires.
- With the button off, the DM request body is exactly `{ content: <message> }`, as today.
- Button: one action row, one button, green (`style: 3`), label `Done`, `custom_id` `done`.
- Done state: content `✅ ~~<original content>~~`, `components: []`.
- Toggle replies, verbatim: `Done button on for: <message>`, `Done button off for: <message>`, `Invalid reminder: <which>`.
- List line, verbatim: `*Button:* on`, shown only when the button is on, as the last line of that reminder.
- Match existing style: snake_case function names, handlers on the default export object of `src/discord.js`, command definitions in `src/constants.js`. Touch only what the task needs.
- Tests live beside the code in `src/*.test.js` and import from `vitest` explicitly. Mock the database with `vi.spyOn(db, "<fn>")` on the default export of `src/db.js`; mock Discord's API with `vi.stubGlobal("fetch", ...)`.
- Tooling in this checkout: run `export NODENV_VERSION=24.16.0` first. Do **not** use `pnpm run` / `pnpm test` (pnpm 11 here fails on ignored build scripts and writes a `pnpm-workspace.yaml` — never commit that file). Call the binaries directly:
  - `node_modules/.bin/vitest run`
  - `node_modules/.bin/eslint .`
  - `node_modules/.bin/prettier --write <files>` then `node_modules/.bin/prettier -c .`
- Git hooks are not installed here, so before every commit run all three and make sure they pass.
- Commit messages follow Conventional Commits (commitlint `config-conventional`: lower-case subject, header ≤ 100 chars). No AI or Claude attribution of any kind in commit messages.

## Review Focus

1. A recurring reminder with the button on keeps the button on its next occurrence (the flag survives the reschedule). → Task 1
2. `button: false` stored explicitly (created with `button:false`, or toggled off) behaves exactly like a missing key: plain DM, no list line. → Tasks 1, 3
3. Toggling must not lose the reminder's time or recurrence settings. → Task 4
4. `/remind button <which>` past the end of the list, including when the user has no reminders, replies `Invalid reminder: <which>` and writes nothing. → Task 4
5. A component click with an unknown `custom_id` gets a 400, not a crash. → Task 2

---

### Task 1: Reminder DM carries the Done button

**Files:**

- Modify: `src/constants.js` (add one export)
- Modify: `src/discord.js` (`message_user` at ~176, its call in `trigger_reminders` at ~204)
- Test: `src/discord.test.js`

**Interfaces:**

- Produces: `export const BUTTON_DONE = "done";` in `src/constants.js` (Task 2 routes on it).

- [ ] **Step 1: Write the tests**

Change the imports at the top of `src/discord.test.js` and add the helpers and `describe` block below the existing `JsonResponse` block:

```js
import { afterEach, describe, expect, test, vi } from "vitest";

import db from "./db.js";
import discord, { JsonResponse } from "./discord.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const env = { DB: {}, DISCORD_TOKEN: "token" };

const stub_fetch = () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ json: async () => ({ id: "dm-1" }) });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

// trigger_reminders makes two fetch calls per reminder: open DM, send message
const sent_body = (fetch) => JSON.parse(fetch.mock.calls[1][1].body);

const due = (config) => ({
  id: 1,
  user_id: "u1",
  ts: 1000,
  message: "Take out the trash",
  config,
});

describe("trigger_reminders", () => {
  test("sends a plain DM when the button is not set", async () => {
    vi.spyOn(db, "triggered_reminders").mockResolvedValue([
      due({ reoccur: false }),
    ]);
    vi.spyOn(db, "delete_reminder").mockResolvedValue();
    const fetch = stub_fetch();

    await discord.trigger_reminders(env);

    expect(sent_body(fetch)).toEqual({ content: "Take out the trash" });
  });

  test("sends a plain DM when the button is false", async () => {
    vi.spyOn(db, "triggered_reminders").mockResolvedValue([
      due({ reoccur: false, button: false }),
    ]);
    vi.spyOn(db, "delete_reminder").mockResolvedValue();
    const fetch = stub_fetch();

    await discord.trigger_reminders(env);

    expect(sent_body(fetch)).toEqual({ content: "Take out the trash" });
  });

  test("adds a Done button when the button is on", async () => {
    vi.spyOn(db, "triggered_reminders").mockResolvedValue([
      due({ reoccur: false, button: true }),
    ]);
    vi.spyOn(db, "delete_reminder").mockResolvedValue();
    const fetch = stub_fetch();

    await discord.trigger_reminders(env);

    expect(sent_body(fetch)).toEqual({
      content: "Take out the trash",
      components: [
        {
          type: 1,
          components: [{ type: 2, style: 3, label: "Done", custom_id: "done" }],
        },
      ],
    });
  });

  test("keeps the button on a recurring reminder's next occurrence", async () => {
    vi.spyOn(db, "triggered_reminders").mockResolvedValue([
      due({ reoccur: true, button: true }),
    ]);
    const update = vi.spyOn(db, "update_reminder").mockResolvedValue();
    stub_fetch();

    await discord.trigger_reminders(env);

    expect(update).toHaveBeenCalledWith(env.DB, 1, expect.any(Number), {
      reoccur: true,
      button: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `node_modules/.bin/vitest run src/discord.test.js`
Expected: "adds a Done button when the button is on" FAILS (body has no `components`). The other three pass already; they pin behavior that must not change.

- [ ] **Step 3: Implement**

- `src/constants.js`: add `export const BUTTON_DONE = "done";`.
- `src/discord.js`: `trigger_reminders` passes the reminder's `config.button` through to `message_user`; `message_user` adds the `components` array above to the message body only when it is truthy. Build the component with `MessageComponentTypes.ACTION_ROW`, `MessageComponentTypes.BUTTON` and `ButtonStyleTypes.SUCCESS` from `discord-interactions`, and `BUTTON_DONE` for `custom_id`.

- [ ] **Step 4: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: all pass.

- [ ] **Step 5: Lint, format, commit**

```bash
node_modules/.bin/prettier --write src/constants.js src/discord.js src/discord.test.js
node_modules/.bin/eslint . && node_modules/.bin/prettier -c . && node_modules/.bin/vitest run
git add src/constants.js src/discord.js src/discord.test.js
git commit -m "feat: add done button to reminder messages"
```

---

### Task 2: Clicking Done marks the message

**Files:**

- Modify: `src/discord.js` (new handler, add to default export)
- Modify: `src/server.js` (new branch after the `APPLICATION_COMMAND` block, before the final "Unknown interaction type" fallthrough)
- Test: `src/discord.test.js`
- Create: `src/server.test.js`

**Interfaces:**

- Consumes: `BUTTON_DONE` from `src/constants.js` (Task 1); the helpers at the top of `src/discord.test.js` (Task 1).
- Produces: `discord.complete_reminder(interaction) -> JsonResponse` on the default export of `src/discord.js`; `post(interaction, env = {})` helper in `src/server.test.js` (Task 4 reuses it).

- [ ] **Step 1: Write the failing tests**

Add to `src/discord.test.js`:

```js
describe("complete_reminder", () => {
  test("marks the message done and removes the button", async () => {
    const response = discord.complete_reminder({
      message: { content: "Take out the trash" },
    });

    expect(await response.json()).toEqual({
      type: 7,
      data: { content: "✅ ~~Take out the trash~~", components: [] },
    });
  });
});
```

Create `src/server.test.js`:

```js
import { afterEach, describe, expect, test, vi } from "vitest";

import server from "./server.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const post = (interaction, env = {}) => {
  vi.spyOn(server, "verifyDiscordRequest").mockResolvedValue({
    isValid: true,
    interaction,
  });
  return server.fetch(
    new Request("http://localhost/", { method: "POST" }),
    env,
  );
};

describe("message component interactions", () => {
  test("a Done click updates the message", async () => {
    const response = await post({
      type: 3,
      data: { custom_id: "done" },
      message: { content: "Take out the trash" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      type: 7,
      data: { content: "✅ ~~Take out the trash~~", components: [] },
    });
  });

  test("an unknown custom_id is rejected", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post({ type: 3, data: { custom_id: "nope" } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unknown Type" });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: `complete_reminder` FAILS (not a function); "a Done click updates the message" FAILS (400). "an unknown custom_id is rejected" passes already via the existing fallthrough.

- [ ] **Step 3: Implement**

- `src/discord.js`: `complete_reminder(interaction)` returns a `JsonResponse` of type `InteractionResponseType.UPDATE_MESSAGE` whose content is `interaction.message.content` wrapped as the Global Constraints specify, with `components: []`. Export it on the default object.
- `src/server.js`: when `interaction.type === InteractionType.MESSAGE_COMPONENT` and `interaction.data.custom_id === BUTTON_DONE`, return `discord.complete_reminder(interaction)`. Any other `custom_id` falls through to the existing 400.

- [ ] **Step 4: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: all pass.

- [ ] **Step 5: Lint, format, commit**

```bash
node_modules/.bin/prettier --write src/discord.js src/server.js src/discord.test.js src/server.test.js
node_modules/.bin/eslint . && node_modules/.bin/prettier -c . && node_modules/.bin/vitest run
git add src/discord.js src/server.js src/discord.test.js src/server.test.js
git commit -m "feat: mark reminder message done when button is clicked"
```

---

### Task 3: `button` option on create, and the list line

**Files:**

- Modify: `src/constants.js` (create subcommand options, after `times`)
- Modify: `src/discord.js` (`pretty_format` at ~90)
- Test: `src/discord.test.js`
- Create: `src/constants.test.js`

**Interfaces:**

- Consumes: the helpers at the top of `src/discord.test.js` (Task 1).
- Produces: `src/constants.test.js` (Task 4 adds to it).

- [ ] **Step 1: Write the tests**

Create `src/constants.test.js`:

```js
import { describe, expect, test } from "vitest";

import { COMMAND_REMIND } from "./constants.js";

const sub_command = (name) =>
  COMMAND_REMIND.options.find((option) => option.name === name);

describe("COMMAND_REMIND", () => {
  test("create has an optional boolean button option", () => {
    expect(sub_command("create").options).toContainEqual({
      name: "button",
      description: "Add a Done button to this reminder? Defaults to false.",
      required: false,
      type: 5,
    });
  });
});
```

Add to `src/discord.test.js`:

```js
const dm = { user: { id: "u1", username: "kelsin" } };

describe("create_reminder", () => {
  test("stores the button option in config", async () => {
    vi.spyOn(db, "get_timezones").mockResolvedValue([]);
    const create = vi.spyOn(db, "create_reminder").mockResolvedValue();

    await discord.create_reminder(
      {
        ...dm,
        data: {
          options: [
            {
              name: "create",
              options: [
                { name: "when", value: "tomorrow at 9am" },
                { name: "what", value: "Take out the trash" },
                { name: "reoccur", value: false },
                { name: "button", value: true },
              ],
            },
          ],
        },
      },
      env.DB,
    );

    expect(create).toHaveBeenCalledWith(
      env.DB,
      "u1",
      expect.any(Number),
      "Take out the trash",
      { reoccur: false, button: true },
    );
  });
});

describe("list_reminders", () => {
  test("shows a Button line only for reminders with the button on", async () => {
    vi.spyOn(db, "get_timezones").mockResolvedValue([]);
    // 2026-01-01 9am, 10am, 11am America/Los_Angeles
    vi.spyOn(db, "list_reminders").mockResolvedValue([
      {
        id: 1,
        ts: 1767286800,
        message: "Take out the trash",
        config: { reoccur: false, button: true },
      },
      {
        id: 2,
        ts: 1767290400,
        message: "Water plants",
        config: { reoccur: true, button: false },
      },
      {
        id: 3,
        ts: 1767294000,
        message: "Call mom",
        config: { reoccur: false },
      },
    ]);

    const response = await discord.list_reminders(dm, env.DB);

    expect((await response.json()).data.content).toBe(
      [
        "You have 3 Reminders:",
        "",
        "**1: Take out the trash**",
        "*When:* 2026-01-01 at 9:00am",
        "*Button:* on",
        "",
        "**2: Water plants**",
        "*Next:* 2026-01-01 at 10:00am",
        "*Reoccurs:* every day, forever",
        "",
        "**3: Call mom**",
        "*When:* 2026-01-01 at 11:00am",
      ].join("\n"),
    );
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: the `constants` test and the `list_reminders` test FAIL. The `create_reminder` test passes already: create copies every option except `when` and `what` into config, and this test pins that for `button`.

- [ ] **Step 3: Implement**

- `src/constants.js`: append the `button` option from the test to the create subcommand's options, after `times`.
- `src/discord.js`: `pretty_format` appends `\n*Button:* on` after the reoccur text when `config.button` is truthy.

- [ ] **Step 4: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: all pass.

- [ ] **Step 5: Lint, format, commit**

```bash
node_modules/.bin/prettier --write src/constants.js src/discord.js src/discord.test.js src/constants.test.js
node_modules/.bin/eslint . && node_modules/.bin/prettier -c . && node_modules/.bin/vitest run
git add src/constants.js src/discord.js src/discord.test.js src/constants.test.js
git commit -m "feat: add button option to reminder create and list"
```

---

### Task 4: `/remind button <which>` toggle, and README

**Files:**

- Modify: `src/constants.js` (new export, new subcommand after `delete`)
- Modify: `src/discord.js` (new handler, add to default export)
- Modify: `src/server.js` (import, new `case` in the sub-command switch)
- Modify: `README.md` (Commands section)
- Test: `src/discord.test.js`, `src/server.test.js`, `src/constants.test.js`

**Interfaces:**

- Consumes: `post(interaction, env)` in `src/server.test.js` (Task 2); `sub_command(name)` in `src/constants.test.js` (Task 3); `env` and `dm` in `src/discord.test.js` (Tasks 1, 3); existing `db.list_reminders(DB, user_id)` and `db.update_reminder(DB, id, ts, config)`.
- Produces: `export const REMIND_BUTTON = "button";` in `src/constants.js`; `discord.toggle_button(interaction, DB) -> Promise<JsonResponse>` on the default export of `src/discord.js`.

- [ ] **Step 1: Write the failing tests**

Add to `src/constants.test.js`, inside the `COMMAND_REMIND` block:

```js
test("has a button subcommand that takes a reminder number", () => {
  expect(sub_command("button")).toEqual({
    name: "button",
    description: "Toggle the Done button on a reminder",
    type: 1,
    options: [
      {
        name: "which",
        description: "Which reminder should we toggle the Done button on?",
        required: true,
        type: 4,
        min_value: 1,
      },
    ],
  });
});
```

Add to `src/discord.test.js`:

```js
describe("toggle_button", () => {
  const toggle = (which) => ({
    ...dm,
    data: {
      options: [{ name: "button", options: [{ name: "which", value: which }] }],
    },
  });

  const scheduled = [
    {
      id: 11,
      ts: 2000,
      message: "Take out the trash",
      config: { reoccur: true, every: 2 },
    },
    {
      id: 12,
      ts: 3000,
      message: "Water plants",
      config: { reoccur: false, button: true },
    },
  ];

  test("turns the button on, keeping the time and the rest of config", async () => {
    vi.spyOn(db, "list_reminders").mockResolvedValue(scheduled);
    const update = vi.spyOn(db, "update_reminder").mockResolvedValue();

    const response = await discord.toggle_button(toggle(1), env.DB);

    expect(update).toHaveBeenCalledWith(env.DB, 11, 2000, {
      reoccur: true,
      every: 2,
      button: true,
    });
    expect((await response.json()).data.content).toBe(
      "Done button on for: Take out the trash",
    );
  });

  test("turns the button off", async () => {
    vi.spyOn(db, "list_reminders").mockResolvedValue(scheduled);
    const update = vi.spyOn(db, "update_reminder").mockResolvedValue();

    const response = await discord.toggle_button(toggle(2), env.DB);

    expect(update).toHaveBeenCalledWith(env.DB, 12, 3000, {
      reoccur: false,
      button: false,
    });
    expect((await response.json()).data.content).toBe(
      "Done button off for: Water plants",
    );
  });

  test("rejects a number past the end of the list", async () => {
    vi.spyOn(db, "list_reminders").mockResolvedValue(scheduled);
    const update = vi.spyOn(db, "update_reminder").mockResolvedValue();

    const response = await discord.toggle_button(toggle(3), env.DB);

    expect(update).not.toHaveBeenCalled();
    expect((await response.json()).data.content).toBe("Invalid reminder: 3");
  });

  test("rejects any number when there are no reminders", async () => {
    vi.spyOn(db, "list_reminders").mockResolvedValue([]);
    const update = vi.spyOn(db, "update_reminder").mockResolvedValue();

    const response = await discord.toggle_button(toggle(1), env.DB);

    expect(update).not.toHaveBeenCalled();
    expect((await response.json()).data.content).toBe("Invalid reminder: 1");
  });
});
```

Add to `src/server.test.js` (add `import discord, { JsonResponse } from "./discord.js";` below the vitest import, above the `./server.js` import):

```js
describe("/remind button", () => {
  test("routes to toggle_button", async () => {
    const toggle_button = vi
      .spyOn(discord, "toggle_button")
      .mockResolvedValue(new JsonResponse({ ok: true }));
    const env = { DB: {} };
    const interaction = {
      type: 2,
      data: {
        name: "remind",
        options: [{ name: "button", options: [{ name: "which", value: 1 }] }],
      },
    };

    const response = await post(interaction, env);

    expect(toggle_button).toHaveBeenCalledWith(interaction, env.DB);
    expect(await response.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: every new test FAILS (`sub_command("button")` is undefined; `toggle_button` is not a function / cannot be spied).

- [ ] **Step 3: Implement**

- `src/constants.js`: `export const REMIND_BUTTON = "button";` and the `button` subcommand from the test, placed after `delete` in `COMMAND_REMIND.options`.
- `src/discord.js`: `toggle_button(interaction, DB)` resolves the reminder the same way `delete_reminder` does (`which` against `db.list_reminders`, same `Invalid reminder: <which>` reply), writes the reminder's config with `button` flipped via `db.update_reminder` using the reminder's existing `ts`, and replies with the new state per the Global Constraints. Export it on the default object.
- `src/server.js`: route `REMIND_BUTTON` to `discord.toggle_button(interaction, env.DB)`.

- [ ] **Step 4: Run the tests**

Run: `node_modules/.bin/vitest run`
Expected: all pass.

- [ ] **Step 5: Update `README.md`**

In the Commands section:

- Add a `/remind button <which>` bullet after `/remind delete`: it takes a number from `/remind list`, toggles the Done button on or off for that reminder, and replies with the new state.
- Change the create signature to `/remind create <when> <what> <reoccur> [every] [unit] [times] [button]` and say that `[button]` (default false) adds a Done button to the reminder message; clicking it marks that message with ✅ and strikes it through so you can see at a glance that it was handled; it changes nothing else, cannot be undone, and reoccurring reminders get a fresh button each time.
- Mention that `/remind list` shows `Button: on` for reminders that have it.

Keep the existing wording and wrapping style; change nothing else in the file.

- [ ] **Step 6: Lint, format, commit**

```bash
node_modules/.bin/prettier --write src/constants.js src/discord.js src/server.js src/discord.test.js src/server.test.js src/constants.test.js README.md
node_modules/.bin/eslint . && node_modules/.bin/prettier -c . && node_modules/.bin/vitest run
git add src/constants.js src/discord.js src/server.js src/discord.test.js src/server.test.js src/constants.test.js README.md
git commit -m "feat: add remind button command to toggle the done button"
```

---

## After the last task

Not part of any task; for Christopher after deploy: re-run `src/register.js` (with `DISCORD_TOKEN` and `DISCORD_APPLICATION_ID` set) so Discord picks up the new `button` option and subcommand.
