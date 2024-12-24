import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import { AutoRouter } from "itty-router";

import {
  COMMAND_REMIND,
  CUSTOM_ID_CREATE_REMINDER,
  CUSTOM_ID_LIST_REMINDERS,
  CUSTOM_ID_REMINDER_MODAL,
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
        return discord.remind();
      }
      default:
        console.error("Unknown command");
        return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
    }
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    switch (interaction.data.custom_id) {
      case CUSTOM_ID_LIST_REMINDERS:
        return discord.list_reminders(interaction, env.DB);
      case CUSTOM_ID_CREATE_REMINDER:
        return discord.create_reminder();
      default:
        console.error("Unknown custom_id", interaction.data.custom_id);
        return new JsonResponse(
          { error: "Unknown Custom ID" },
          { status: 400 },
        );
    }
  }

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    switch (interaction.data.custom_id) {
      case CUSTOM_ID_REMINDER_MODAL:
        return discord.get_date();
      default:
        console.error("Unknown custom_id", interaction.data.custom_id);
        return new JsonResponse(
          { error: "Unknown Custom ID" },
          { status: 400 },
        );
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

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
