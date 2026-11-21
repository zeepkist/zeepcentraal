use anyhow::Result;
use diesel::{
    sql_query,
    sql_types::{Array, Integer},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};

impl crate::Database {
    pub async fn mark_user_medal_counts_dirty(&self, users: &[i32]) -> Result<()> {
        sql_query("SELECT zc_private.mark_user_medal_counts_dirty($1)")
            .bind::<Array<Integer>, _>(users)
            .execute(&mut self.connection().await?)
            .await?;
        Ok(())
    }
}

/// Caller holds user score locks. Count-only writes preserve points and rank.
pub(crate) async fn refresh_user_record_counts(
    connection: &mut AsyncPgConnection,
    users: &[i32],
) -> Result<()> {
    sql_query(
        "INSERT INTO public.user_points(id_user,personal_bests,world_records,date_updated) \
         SELECT id_user,personal_bests,world_records,clock_timestamp() \
         FROM zc_private.user_record_counts($1) \
         ON CONFLICT(id_user) DO UPDATE SET personal_bests=excluded.personal_bests, \
           world_records=excluded.world_records,date_updated=excluded.date_updated \
         WHERE ROW(user_points.personal_bests,user_points.world_records) \
           IS DISTINCT FROM ROW(excluded.personal_bests,excluded.world_records)",
    )
    .bind::<Array<Integer>, _>(users)
    .execute(connection)
    .await?;
    sql_query("SELECT zc_private.refresh_dirty_user_medal_counts($1)")
        .bind::<Array<Integer>, _>(users)
        .execute(connection)
        .await?;
    Ok(())
}
