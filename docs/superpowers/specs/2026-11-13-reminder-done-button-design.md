# Reminder Done Button — Design

## Intent

When looking back at a reminder DM in Discord, be able to see "Oh, I did that."
The button is a visual mark on the message only. A clicked reminder and an
unclicked reminder behave identically.

## Goals

- An optional, per-reminder Done button on the reminder DM.
- The option can be set when creating a reminder.
- The option can be toggled on and off for reminders that are already scheduled.

## Non-goals

- Tracking completion, nagging about unclicked reminders, or any other change
  in behavior based on the click.
- Undoing a click.
- Adding a button to DMs that were already sent (the bot does not keep their
  message IDs).

## Anti-goal

Storing anything about a reminder after it fires.

## Approaches

**Handling the click**

1. _Stateless (picked)._ The click handler rewrites the DM using the message
   content Discord sends with the click. No database access.
2. _Track completion in the database._ Rejected: nothing reads that state,
   since a clicked reminder must not behave differently.

**Turning the option on for existing reminders**

1. _`/remind button <which>` (picked by Christopher)._ A dedicated subcommand
   that toggles the option on and off.
2. _`/remind edit <which> [button]`._ Same code, but the name promises general
   editing that does not exist.
3. _Toggle buttons inside `/remind list`._ Dropped: Discord caps a message at
   25 buttons and it is much more code for the same result.

## Design

**Storage.** A boolean `button` key in the reminder's existing `config` JSON.
Missing means off. No migration.

**`/remind create`.** New optional boolean option `button`, off by default.
Create already copies every option other than `when` and `what` into `config`,
so the flag is stored with no further change to `create_reminder`.

**`/remind button <which>`.** New subcommand. `<which>` is the number shown by
`/remind list`, the same numbering `/remind delete` uses. It flips
`config.button` and replies with the new state:

- `Done button on for: <message>`
- `Done button off for: <message>`
- `Invalid reminder: <which>` when the number is out of range (same as delete)

**`/remind list`.** A reminder with the button on gets one extra line,
`*Button:* on`. Reminders with the button off are unchanged.

**Sending the reminder.** When `config.button` is true, the DM carries one
action row with one green button labelled `Done`, `custom_id` of `done`. When
it is not, the DM is exactly what it is today. A recurring reminder gets a
fresh button on every DM.

```
Take out the trash
[ Done ]
```

**Clicking Done.** The server handles the message-component interaction with
`custom_id` of `done` by updating the message in place: the content becomes
`✅ ~~<original content>~~` and the button is removed.

```
✅ ~~Take out the trash~~
```

Any other `custom_id` gets the same 400 "Unknown Type" response as other
unknown interactions.

**Docs.** README documents the `button` option on create and the
`/remind button` command.

**Deploy.** `src/register.js` has to be re-run so Discord picks up the new
option and subcommand.

## Calls made on Christopher's behalf

- `/remind button <which>` is a true toggle with no on/off argument; the reply
  states the new state.
- The option is named `button` on `create`.
- `/remind list` shows the line only when the button is on.
- The button is green and labelled `Done`.
- The done state is a ✅ prefix plus strikethrough, with the button removed.

## Left to the builder

- How to structure the tests. The current suite only covers `JsonResponse`;
  the new behavior needs tests for the DM payload with and without the button,
  the click response, the toggle command, and the list line.
