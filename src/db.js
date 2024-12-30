const prepare_result = (result) => ({
  ...result,
  config: JSON.parse(result.config || "{}"),
});

const list_reminders = async (DB, user_id) => {
  const { results } = await DB.prepare(
    "SELECT * FROM reminders WHERE user_id = ? AND ts >= unixepoch() ORDER BY ts",
  )
    .bind(user_id.toString())
    .all();
  return results.map(prepare_result);
};

const create_reminder = async (DB, user_id, ts, message, config) => {
  return await DB.prepare(
    "INSERT INTO reminders (user_id, ts, message, config) VALUES (?, ?, ?, ?)",
  )
    .bind(user_id, ts, message, JSON.stringify(config))
    .all();
};

const delete_reminder = async (DB, id) => {
  return await DB.prepare("DELETE FROM reminders WHERE id = ?").bind(id).all();
};

const triggered_reminders = async (DB) => {
  const { results } = await DB.prepare(
    "SELECT * FROM reminders WHERE ts <= unixepoch() ORDER BY ts",
  ).all();
  return results.map(prepare_result);
};

const update_reminder = async (DB, id, ts, config) => {
  return await DB.prepare(
    "UPDATE reminders SET ts = ?, config = ? WHERE id = ?",
  )
    .bind(ts, JSON.stringify(config), id)
    .all();
};

const set_timezone = async (DB, id, timezone) => {
  return await DB.prepare(
    "INSERT INTO timezones (discord_id, timezone) VALUES (?1, ?2) ON CONFLICT (discord_id) DO UPDATE SET timezone = ?2",
  )
    .bind(id, timezone)
    .all();
};

const delete_timezone = async (DB, id) => {
  return await DB.prepare("DELETE FROM timezones WHERE discord_id = ?")
    .bind(id)
    .all();
};

const get_timezones = async (DB, ids) => {
  const sqls = [];
  const vars = [];

  ids.forEach((id, index) => {
    sqls.push(
      `SELECT ? as priority, ? as scope, ? as discord_id, ? as name, (SELECT timezone FROM timezones WHERE discord_id = ?) as timezone`,
    );
    vars.push(index);
    vars.push(id.scope);
    vars.push(id.id.toString());
    vars.push(id.name || null);
    vars.push(id.id.toString());
  });
  const sql = sqls.join(" UNION ") + " ORDER BY priority";
  const { results } = await DB.prepare(sql)
    .bind(...vars)
    .all();
  return results;
};

export default {
  delete_timezone,
  get_timezones,
  set_timezone,
  create_reminder,
  delete_reminder,
  list_reminders,
  update_reminder,
  triggered_reminders,
};
