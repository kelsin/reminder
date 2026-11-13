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
});
