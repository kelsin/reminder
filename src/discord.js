import * as chrono from "chrono-node";
import dayjs from "dayjs";
import advFormat from "dayjs/plugin/advancedFormat";
import tzPlugin from "dayjs/plugin/timezone";
import utcPlugin from "dayjs/plugin/utc";
import {
  InteractionResponseFlags,
  InteractionResponseType,
} from "discord-interactions";

import db from "./db.js";

dayjs.extend(advFormat);
dayjs.extend(utcPlugin);
dayjs.extend(tzPlugin);

const DEFAULT_TZ = "America/Los_Angeles";

const ADMINISTRATOR = BigInt(1 << 3);
const MANAGE_CHANNELS = BigInt(1 << 4);
const MANAGE_GUILD = BigInt(1 << 5);

const is_admin = (interaction) => {
  if (!interaction.guild) {
    return false;
  }
  return !!(BigInt(interaction.member.permissions) & ADMINISTRATOR);
};
const is_channel_manager = (interaction) => {
  if (!interaction.guild) {
    return false;
  }
  return !!(BigInt(interaction.member.permissions) & MANAGE_CHANNELS);
};
const is_guild_manager = (interaction) => {
  if (!interaction.guild) {
    return false;
  }
  return !!(BigInt(interaction.member.permissions) & MANAGE_GUILD);
};

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
      flags: InteractionResponseFlags.EPHEMERAL,
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

const pretty_format = (when, what, config, tz, number = null) => {
  const next = dayjs.unix(when).tz(tz);
  const next_formatted = next.format("YYYY-MM-DD [at] h:mma");
  const when_label = config.reoccur ? "Next" : "When";
  const reoccur = pretty_reoccur(config);
  const index = number ? `${number}: ` : "";
  return `**${index}${what}**\n*${when_label}:* ${next_formatted}${reoccur}`;
};

const pretty_reminder = (reminder, tz, number = null) => {
  return pretty_format(
    reminder.ts,
    reminder.message,
    reminder.config,
    tz,
    number,
  );
};

const list_reminders = async (interaction, DB) => {
  const user_id = get_user_id(interaction);
  const tz = await get_timezone(interaction, DB);
  const results = await db.list_reminders(DB, user_id);
  if (results.length === 0) {
    return message("No current reminders");
  }

  let reminders = reminders_header(results.length);

  results.forEach((reminder, index) => {
    const pretty = pretty_reminder(reminder, tz, index + 1);
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

  await db.delete_reminder(DB, reminder.id);

  return message(`Deleted reminder: ${reminder.message}`);
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

  const tz = await get_timezone(interaction, DB);
  const ts = dayjs(
    chrono.parseDate(options.when, {}, { forwardDate: true }),
  ).tz(tz, true);
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

const interaction_ids = (interaction) => {
  const ids = [];
  if (interaction.guild) {
    ids.push({
      scope: "server",
      id: interaction.guild.id,
    });
  }
  if (interaction.channel && interaction.channel.type === 0) {
    ids.push({
      scope: "channel",
      name: interaction.channel.name,
      id: interaction.channel.id,
    });
  }
  if (interaction.member) {
    ids.push({
      scope: "user",
      name:
        interaction.member.nick ||
        interaction.member.user.global_name ||
        interaction.member.user.username,
      id: interaction.member.user.id,
    });
  } else {
    ids.push({
      scope: "user",
      name: interaction.user.global_name || interaction.user.username,
      id: interaction.user.id,
    });
  }
  return ids;
};

const get_timezone = async (interaction, DB) => {
  const ids = interaction_ids(interaction);
  const tzs = await db.get_timezones(DB, ids);
  tzs.unshift({ scope: "global", timezone: DEFAULT_TZ });

  // Set default to last item with a timezone set
  for (let i = tzs.length - 1; i >= 0; i--) {
    if (tzs[i].timezone) {
      return tzs[i].timezone;
    }
  }
};

const timezone_defaults = async (interaction, DB) => {
  const tz_command = interaction.data.options[0];
  const sub_command = tz_command.options[0];

  if (sub_command.name === "get") {
    const tz = await get_timezone(interaction, DB);
    return message(`Current Timezone: **${tz}**`);
  }

  if (sub_command.name === "defaults") {
    const ids = interaction_ids(interaction);
    const tzs = await db.get_timezones(DB, ids);
    tzs.unshift({ scope: "global", timezone: DEFAULT_TZ });

    // Set default to last item with a timezone set
    for (let i = tzs.length - 1; i >= 0; i--) {
      if (tzs[i].timezone) {
        tzs[i]["default"] = true;
        break;
      }
    }

    let response = "Timezone Defaults";
    tzs.forEach((tz) => {
      let label = tz.scope;

      if (label === "channel") {
        label = `#${tz.name}`;
      } else if (label === "user") {
        label = `@${tz.name}`;
      }

      response += "\n- ";
      if (tz.default) {
        response += "**";
      }
      response += `${label}: `;
      if (tz.timezone) {
        response += tz.timezone;
      } else {
        response += "*Not Set*";
      }
      if (tz.default) {
        response += "**";
      }
    });
    return message(response);
  }

  const options = sub_command.options.reduce((options, option) => {
    return {
      ...options,
      [option.name]: option.value,
    };
  }, {});

  if (options.scope === "server") {
    if (!interaction.member) {
      return message("Can only change server timezone from a channel");
    }

    if (!is_admin(interaction) && !is_guild_manager(interaction)) {
      return message(
        "Must be an admin or server manager to change server timezone",
      );
    }

    if (sub_command.name === "set") {
      await db.set_timezone(DB, interaction.guild.id, options.timezone);
      return message(`Setting server timezone to: ${options.timezone}`);
    } else {
      await db.delete_timezone(DB, interaction.guild.id);
      return message("Removing server timezone");
    }
  }

  if (options.scope === "channel") {
    if (!interaction.member) {
      return message("Can only set channel timezone from a channel");
    }

    if (!is_admin(interaction) && !is_channel_manager(interaction)) {
      return message(
        "Must be an admin or channel manager to change channel timezone",
      );
    }

    if (sub_command.name === "set") {
      await db.set_timezone(DB, interaction.channel.id, options.timezone);
      return message(`Setting channel timezone to: ${options.timezone}`);
    } else {
      await db.delete_timezone(DB, interaction.channel.id);
      return message("Removing channel timezone");
    }
  }

  const user_id = get_user_id(interaction);
  if (sub_command.name === "set") {
    await db.set_timezone(DB, user_id, options.timezone);
    return message(`Setting user timezone to: ${options.timezone}`);
  } else {
    await db.delete_timezone(DB, user_id);
    return message("Removing user timezone");
  }
};

export default {
  create_reminder,
  delete_reminder,
  list_reminders,
  trigger_reminders,
  timezone_defaults,
};
