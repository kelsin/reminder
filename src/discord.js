import {
  ButtonStyleTypes,
  InteractionResponseType,
  MessageComponentTypes,
  TextStyleTypes,
} from "discord-interactions";

import {
  CUSTOM_ID_CREATE_REMINDER,
  CUSTOM_ID_LIST_REMINDERS,
  CUSTOM_ID_REMINDER_MESSAGE,
  CUSTOM_ID_REMINDER_MODAL,
} from "./constants.js";
import db from "./db.js";

const jsonHeaders = {
  headers: {
    "content-type": "application/json;charset=UTF-8",
  },
};

export class JsonResponse extends Response {
  constructor(body, init = {}) {
    const jsonBody = JSON.stringify(body);
    super(jsonBody, { ...jsonHeaders, ...init });
  }
}

const buttons = (options = []) => {
  return [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: options.map((option) => {
        return {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.SECONDARY,
          label: option[0],
          custom_id: option[1],
        };
      }),
    },
  ];
};

const message = (content, components = []) => {
  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      components,
    },
  });
};

const update = (content, components = []) => {
  return new JsonResponse({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content,
      components,
    },
  });
};

const modal = (custom_id, title, components = []) => {
  return new JsonResponse({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id,
      title,
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components,
        },
      ],
    },
  });
};

const remind = () => {
  return message(
    "What would you like to do?",
    buttons([
      ["List Reminders", CUSTOM_ID_LIST_REMINDERS],
      ["Create New Reminder", CUSTOM_ID_CREATE_REMINDER],
    ]),
  );
};

const list_reminders = async (interaction, DB) => {
  const results = await db.list_reminders(DB, interaction.member.user.id);
  if (results.length === 0) {
    return update("No current reminders");
  }

  return update(`${results.length} reminder(s)`);
};

const create_reminder = () => {
  return modal(CUSTOM_ID_REMINDER_MODAL, "What should I remind you of?", [
    {
      type: MessageComponentTypes.INPUT_TEXT,
      style: TextStyleTypes.SHORT,
      custom_id: CUSTOM_ID_REMINDER_MESSAGE,
      label: "What?",
      placeholder: "What?",
      required: true,
    },
  ]);
};

const get_date = () => {
  return update("Fun Fun");
};

export default {
  create_reminder,
  get_date,
  list_reminders,
  remind,
};
