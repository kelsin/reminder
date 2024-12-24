const list_reminders = async (DB, user_id) => {
  const { results } = await DB.prepare(
    "SELECT * FROM reminders WHERE user_id = ? AND ts >= unixepoch()",
  )
    .bind(user_id)
    .all();
  return results;
};

export default {
  list_reminders,
};
