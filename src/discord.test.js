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

describe("JsonResponse", () => {
  test("adds JSON headers to empty response", () => {
    const response = new JsonResponse({});
    expect(response.status).toBe(200);
    expect(response.headers.has("content-type")).toBe(true);
    expect(response.headers.get("content-type")).toBe(
      "application/json;charset=UTF-8",
    );
  });

  test("adds JSON headers to an error response", () => {
    const response = new JsonResponse("Error String", { status: 400 });
    expect(response.status).toBe(400);
    expect(response.headers.has("content-type")).toBe(true);
    expect(response.headers.get("content-type")).toBe(
      "application/json;charset=UTF-8",
    );
  });
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
