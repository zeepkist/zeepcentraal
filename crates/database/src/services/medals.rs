use crate::Database;
use anyhow::Result;
use diesel::{
    QueryableByName, sql_query,
    sql_types::{Bool, Integer},
};
use diesel_async::RunQueryDsl;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(i16)]
pub enum MedalTier {
    Bronze = 0,
    Silver = 1,
    Gold = 2,
    Author = 3,
    Expert = 4,
    Apex = 5,
}

#[derive(QueryableByName)]
struct Refreshed {
    #[diesel(sql_type = Bool)]
    refreshed: bool,
}

impl Database {
    pub async fn refresh_medals(&self, id_level: Option<i32>) -> Result<bool> {
        let mut connection = self.connection().await?;
        if let Some(id_level) = id_level {
            let row = sql_query("SELECT zc_private.refresh_level_medals($1) AS refreshed")
                .bind::<Integer, _>(id_level)
                .get_result::<Refreshed>(&mut connection)
                .await?;
            return Ok(row.refreshed);
        }
        // Persistent deadlines survive worker restarts. Stable keys coalesce retries.
        sql_query(
            "SELECT zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',id_level), \
            'refresh-medals:'||id_level,'medals:'||id_level,3,clock_timestamp()) \
            FROM public.level_item WHERE medal_due_at<=clock_timestamp() \
            GROUP BY id_level ORDER BY min(medal_evaluated_at),id_level LIMIT 100",
        )
        .execute(&mut connection)
        .await?;
        Ok(true)
    }
}
