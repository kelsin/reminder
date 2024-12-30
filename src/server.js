import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import { AutoRouter } from "itty-router";

import {
  COMMAND_REMIND,
  REMIND_CREATE,
  REMIND_DELETE,
  REMIND_LIST,
  REMIND_TIMEZONE,
} from "./constants.js";
import discord, { JsonResponse } from "./discord.js";

const router = AutoRouter();

router.get("/", (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post("/", async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );

  if (!isValid || !interaction) {
    return new Response("Bad request signature.", { status: 401 });
  }

  if (interaction.type === 0) {
    // Event ping
    return new JsonResponse(null, { status: 204 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case COMMAND_REMIND.name.toLowerCase(): {
        const sub_command = interaction.data.options[0].name;
        switch (sub_command) {
          case REMIND_LIST:
            return discord.list_reminders(interaction, env.DB);
          case REMIND_CREATE:
            return discord.create_reminder(interaction, env.DB);
          case REMIND_DELETE:
            return discord.delete_reminder(interaction, env.DB);
          case REMIND_TIMEZONE:
            return discord.timezone_defaults(interaction, env.DB);
          default:
            console.error("Unknown command");
            return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
        }
      }
      default:
        console.error("Unknown command");
        return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
    }
  }

  console.error("Unknown interaction type", interaction.type);
  return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
});

router.all("*", () => new Response("Not Found.", { status: 404 }));

const verifyDiscordRequest = async (request, env) => {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
};

const scheduled = async (event, env, ctx) => {
  ctx.waitUntil(discord.trigger_reminders(env));
};

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
  scheduled,
};

export default server;
