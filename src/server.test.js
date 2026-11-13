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
