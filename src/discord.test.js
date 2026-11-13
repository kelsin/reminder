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
