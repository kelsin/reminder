# Reminder

[![build](https://img.shields.io/github/check-runs/kelsin/reminder/main?logo=github&logoColor=%23fff&label=build)](https://github.com/kelsin/reminder/actions/workflows/test.yml?query=branch%3Amain)
[![coveralls](https://img.shields.io/coverallsCoverage/github/kelsin/reminder?logo=coveralls&logoColor=%23fff)](https://coveralls.io/github/kelsin/reminder)
[![license](https://img.shields.io/github/license/kelsin/reminder?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBzdHJva2U9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNNyAyMGwxMCAwIi8%2BPHBhdGggZD0iTTYgNmw2IC0xbDYgMSIvPjxwYXRoIGQ9Ik0xMiAzbDAgMTciLz48cGF0aCBkPSJNOSAxMmwtMyAtNmwtMyA2YTMgMyAwIDAgMCA2IDAiLz48cGF0aCBkPSJNMjEgMTJsLTMgLTZsLTMgNmEzIDMgMCAwIDAgNiAwIi8%2BPC9zdmc%2B&logoColor=%23fff&color=%23750014)](https://github.com/kelsin/reminder?tab=MIT-1-ov-file#readme)

Simple Discord Reminder Bot

## Usage

This bot allows you to create, list and delete reminders for yourself. You can
interact with the bot with the `/remind` command in any channel that it's
activated in, or in a DM with the bot itself. All reminders will be DM messages
to your user when they trigger (even if they were created from a channel). When
interacting with the bot from a channel only you can see the
interactions. Reminders can be set to reoccur according to some simple rules.

### Commands

- `/remind list`: This command will list all of your current reminders (ordered
  by the time that they will next trigger).

- `/remind delete <which>`: This command takes in a number and deletes one of
  your reminders. The numbers used are the numbers displayed as part of `/remind
list`. This means that `/remind delete 1` always will delete the reminder
  that's coming up next. Currently there is no way to delete only a certain
  instance of a reoccuring reminder.

- `/remind create <when> <what> <reoccur> [every] [unit] [times]`: This command
  creates a new reminder. The `<when>` field takes in many date forms in plain
  english. Values like "next Tuesday at 9am" or "Saturday at 11pm" work. For
  reoccuring reminders this should always be the time of the FIRST reoccurance
  of the reminder only. The `<what>` field is the message that will be sent to
  you when the reminder triggers. If you set `<reoccur>` to `false` than the
  reminder will only trigger once at the `<when>` time. If `<reoccur>` is set to
  true than this reminder will repeat itself after the first instance based on
  the optional values of `[every]`, `[unit]` and `[times]`. For more information
  on how to setup repeating reminders please see the next section.

### Repeat Reminders

When a reminder triggers we check the `<reoccur>` field setting and then we run
the following logic:

1. If the `[times]` field was currently set to `1` we delete the reminder.
2. If `[times]` is set to a higher number than `1` we lower this number by one.
3. We take the current time of the reminder that just triggered and add a unit
   of time to it based on the values of `[every]` and `[unit]`.
4. We update the reminder to this newly calculated time and `[times]` value.

The create command defaults `[every]`, `[unit]` and `[times]` to `1`, `day` and
`forever`. This means that if you don't set any of them you'll get a reminder
that will trigger at the same time every day forever. This means that by default
a reminder with `<reoccur>` set to true will occur at the same time every day
forever.

Setting `[every]` will make this reminder occur every `X` instances of the
`[unit]` value. For example using the default values and setting `[every]` to 3
will mean "Every 3 days". `[unit]` will set the time unit and currently the
following values are available: `minute, hour, day, week, month,
year`. `[times]` will set how many times this reminder will trigger. By default
it's set to `forever` so will never end. Otherwise it will occur `X` times and
then be done!

With these settings, reminders like the following are possible:

1. Every 3 days, forever
2. Every year, 3 times
3. Every 8 hours, 5 times
4. Every month, forever
5. etc...

> [!NOTE]
> The reminder app only runs every 15 minutes, so anything set to reoccur at an
> interval of less than this won't effectively work. Every 15 minutes we will
> trigger any reminders that are currently past their trigger time.

### Timezones

This bot defaults to interpreting all dates and times as `America/Los_Angeles`
since the author is based in southern California. You can change this per
server, channel and user.

When interacting with the bot via DM's the only timezone settings that matter are
the global default and the user override. When interacting with the bot from a
channel, the server and channel overrides also can take effect. The user
override takes priority at all times followed by the channel (if applicable),
then server (if applicable). If no overrides are set the default global timezone
is used.

You can view all timezone settings that apply by running the `/remind timezone
defaults` command. The output will bold the timezone that is currently going to
be used for your commands. To only view the timezone that will be used for your
commands you can run `/remind timezone get`.

To set a timezone override you can run `/remind timezone set <scope>
<timezone>`. The `<timezone>` field can be any [standard timezone
string](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

> [!WARNING]
> The `<timezone>` field is not validated so please be careful to test after
> setting a default to make sure it's a valid timezone string.

The `<scope>` field can be set to `Server`, `Channel`, or `User`. When you run
this command it will set the timezone for the current server, current channel or
current user. This means that users can only set the defaults for themselves
regardless of permissions. To set the default on a server you need administrator
permissions or manage server permissions on the discord server you're using it
from. To set permissions for a channel you need administrator or manage channel
permissions on the channel you're using it from. Trying to set `Server` or
`Channel` defaults from a DM with the bot will result in an error.

To remove a default you can run `/remind timezone delete <scope>` with the same
scope rules as above.
