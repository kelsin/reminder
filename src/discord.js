import * as chrono from "chrono-node";
import dayjs from "dayjs";
import advFormat from "dayjs/plugin/advancedFormat";
import { InteractionResponseType } from "discord-interactions";

import db from "./db.js";

dayjs.extend(advFormat);

const jsonHeaders = {
  headers: {
    "content-type": "application/json;charset=UTF-8",
  },
};

export class JsonResponse extends Response {
  constructor(body, init = {}) {
    const jsonBody = body === null ? null : JSON.stringify(body);
    super(jsonBody, { ...jsonHeaders, ...init });
  }
}

const message = (content, components = []) => {
  return new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      components,
    },
  });
};

const get_user_id = (interaction) =>
  interaction.member ? interaction.member.user.id : interaction.user.id;

const reminders_header = (number) => {
  const reminder = number > 1 ? "Reminders" : "Reminder";
  return `You have ${number} ${reminder}:`;
};

const pretty_reoccur = (config) => {
  if (!config.reoccur) {
    return "";
  }

  const every = config.every || 1;
  const times = config.times || 0;
  const unit = config.unit || "day";

  const count =
    times === 0 ? "forever" : times > 1 ? `${times} more times` : "1 more time";
  const reoccur = every === 1 ? `every ${unit}` : `every ${every} ${unit}s`;

  return `\n*Reoccurs:* ${reoccur}, ${count}`;
};

const pretty_format = (when, what, config, number = null) => {
  const next = dayjs.unix(when);
  const next_formatted = next.format("YYYY-MM-DD [at] h:mma");
  const when_label = config.reoccur ? "Next" : "When";
  const reoccur = pretty_reoccur(config);
  const index = number ? `${number}: ` : "";
  return `**${index}${what}**\n*${when_label}:* ${next_formatted}${reoccur}`;
};

const pretty_reminder = (reminder, number = null) => {
  return pretty_format(reminder.ts, reminder.message, reminder.config, number);
};

const list_reminders = async (interaction, DB) => {
  const user_id = get_user_id(interaction);
  const results = await db.list_reminders(DB, user_id);
  if (results.length === 0) {
    return message("No current reminders");
  }

  let reminders = reminders_header(results.length);

  results.forEach((reminder, index) => {
    const pretty = pretty_reminder(reminder, index + 1);
    reminders += `\n\n${pretty}`;
  });

  return message(reminders);
};

const delete_reminder = async (interaction, DB) => {
  const sub_command = interaction.data.options[0];
  const which = sub_command.options[0].value;
  const user_id = get_user_id(interaction);
  const reminders = await db.list_reminders(DB, user_id);

  if (which > reminders.length) {
    return message(`Invalid reminder: ${which}`);
  }

  const reminder = reminders[which - 1];
  const when = dayjs.unix(reminder.ts);
  const formatted = when.format("YYYY-MM-DD [at] h:mma");

  await db.delete_reminder(DB, reminder.id);

  return message(`Deleted reminder - ${formatted}: ${reminder.message}`);
};

const create_reminder = async (interaction, DB) => {
  const user_id = get_user_id(interaction);
  const sub_command = interaction.data.options[0];

  const options = sub_command.options.reduce((options, option) => {
    return {
      ...options,
      [option.name]: option.value,
    };
  }, {});

  const ts = dayjs(chrono.parseDate(options.when));
  if (!ts.isValid()) {
    return message(`Invalid date: ${options.when}`);
  }
  if (ts.isBefore(dayjs())) {
    return message(`Can't schedule a reminder in the past: ${options.when}`);
  }

  const what = options.what;
  delete options.what;
  delete options.when;

  await db.create_reminder(DB, user_id, ts.unix(), what, options);
  const formatted = ts.format("dddd, MMMM Do YYYY [at] h:mma");
  const response = `I will remind you about "${what}" on ${formatted}`;
  return message(response);
};

const message_user = async (env, user_id, message) => {
  const response = await fetch("https://discord.com/api/users/@me/channels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
    body: JSON.stringify({ recipient_id: user_id }),
  });
  const channel = await response.json();
  const id = channel.id;

  await fetch(`https://discord.com/api/channels/${id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
    },
    body: JSON.stringify({ content: message }),
  });
};

const trigger_reminders = async (env) => {
  const reminders = await db.triggered_reminders(env.DB);

  for (let i = 0; i < reminders.length; i++) {
    let reminder = reminders[i];

    await message_user(env, reminder.user_id, reminder.message);

    if (!reminder.config.reoccur) {
      await db.delete_reminder(env.DB, reminder.id);
      continue;
    }

    const config = reminder.config;
    const every = config.every || 1;
    const times = config.times || 0;
    const unit = config.unit || "day";

    if (times === 1) {
      await db.delete_reminder(env.DB, reminder.id);
      continue;
    }

    const next_ts = dayjs.unix(reminder.ts).add(every, unit).unix();
    const next_config = { ...config };
    if (times > 1) {
      next_config.times = times - 1;
    }
    await db.update_reminder(env.DB, reminder.id, next_ts, next_config);
  }
};

export default {
  create_reminder,
  delete_reminder,
  list_reminders,
  trigger_reminders,
};
