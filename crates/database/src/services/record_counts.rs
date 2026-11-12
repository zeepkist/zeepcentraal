use anyhow::Result;
use diesel::{
    sql_query,
    sql_types::{Array, Integer},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};

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
    sql_query(
        "INSERT INTO public.user_points(id_user,medal_apex,medal_expert,medal_author,medal_gold,medal_silver,medal_bronze,medal_none,date_updated) \
         SELECT id_user,apex,expert,author,gold,silver,bronze,\"none\",clock_timestamp() FROM zc_private.user_medal_counts($1) \
         ON CONFLICT(id_user) DO UPDATE SET medal_apex=excluded.medal_apex,medal_expert=excluded.medal_expert, \
         medal_author=excluded.medal_author,medal_gold=excluded.medal_gold,medal_silver=excluded.medal_silver, \
         medal_bronze=excluded.medal_bronze,medal_none=excluded.medal_none,date_updated=excluded.date_updated \
         WHERE ROW(user_points.medal_apex,user_points.medal_expert,user_points.medal_author,user_points.medal_gold,user_points.medal_silver,user_points.medal_bronze,user_points.medal_none) \
         IS DISTINCT FROM ROW(excluded.medal_apex,excluded.medal_expert,excluded.medal_author,excluded.medal_gold,excluded.medal_silver,excluded.medal_bronze,excluded.medal_none)",
    )
    .bind::<Array<Integer>, _>(users)
    .execute(connection)
    .await?;
    Ok(())
}
