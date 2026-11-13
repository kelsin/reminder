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
