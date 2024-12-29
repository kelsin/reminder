export const REMIND = "remind";
export const REMIND_LIST = "list";
export const REMIND_CREATE = "create";
export const REMIND_DELETE = "delete";
export const COMMAND_REMIND = {
  name: REMIND,
  description: "Add a reminder.",
  options: [
    {
      name: REMIND_LIST,
      description: "Show your current reminders",
      type: 1,
    },
    {
      name: REMIND_CREATE,
      description: "Create a new reminder",
      type: 1,
      options: [
        {
          name: "when",
          description: "When should we remind you?",
          required: true,
          type: 3,
        },
        {
          name: "what",
          description: "What should I remind you of?",
          required: true,
          type: 3,
        },
        {
          name: "reoccur",
          description: "Should this reminder reoccur?",
          required: true,
          type: 5,
        },
        {
          name: "every",
          description:
            "How many time units between each reminder? Defaults to 1.",
          required: false,
          type: 4,
          min_value: 1,
        },
        {
          name: "unit",
          description:
            "What time unit to use for this reoccuring reminder? Defaults to Day.",
          required: false,
          type: 3,
          choices: [
            { name: "Day", value: "day" },
            { name: "Week", value: "week" },
            { name: "Month", value: "month" },
            { name: "Year", value: "year" },
            { name: "Hour", value: "hour" },
            { name: "Minute", value: "minute" },
          ],
        },
        {
          name: "times",
          description: "How many times to reoccur? Defaults to Forever.",
          required: false,
          type: 4,
          choices: [
            { name: "Forever", value: 0 },
            { name: "1 time", value: 1 },
            { name: "2 times", value: 2 },
            { name: "3 times", value: 3 },
            { name: "4 times", value: 4 },
            { name: "5 times", value: 5 },
            { name: "6 times", value: 6 },
            { name: "7 times", value: 7 },
            { name: "8 times", value: 8 },
            { name: "9 times", value: 9 },
            { name: "10 times", value: 10 },
            { name: "11 times", value: 11 },
            { name: "12 times", value: 12 },
            { name: "13 times", value: 13 },
            { name: "14 times", value: 14 },
            { name: "15 times", value: 15 },
            { name: "16 times", value: 16 },
            { name: "17 times", value: 17 },
            { name: "18 times", value: 18 },
            { name: "19 times", value: 19 },
            { name: "20 times", value: 20 },
            { name: "21 times", value: 21 },
            { name: "22 times", value: 22 },
            { name: "23 times", value: 23 },
            { name: "24 times", value: 24 },
          ],
        },
      ],
    },
    {
      name: REMIND_DELETE,
      description: "Delete a reminder",
      type: 1,
      options: [
        {
          name: "which",
          description: "Which reminder should we delete?",
          required: true,
          type: 4,
          min_value: 1,
        },
      ],
    },
  ],
};
