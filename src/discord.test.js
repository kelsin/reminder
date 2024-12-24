import { describe, expect, test } from "vitest";

import { JsonResponse } from "./discord.js";

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
