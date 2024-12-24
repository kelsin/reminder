import {
  // InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import { AutoRouter } from "itty-router";

import { REMIND } from "./commands.js";

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
      case REMIND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "Remind!",
          },
        });
      }
      default:
        console.error("Unknown command");
        return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
    }
  }

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
