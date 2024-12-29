const prepare_result = (result) => ({
  ...result,
  config: JSON.parse(result.config || "{}"),
});

const list_reminders = async (DB, user_id) => {
  const { results } = await DB.prepare(
    "SELECT * FROM reminders WHERE user_id = ? AND ts >= unixepoch()",
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
    "SELECT * FROM reminders WHERE ts <= unixepoch()",
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

export default {
  create_reminder,
  delete_reminder,
  list_reminders,
  update_reminder,
  triggered_reminders,
};
