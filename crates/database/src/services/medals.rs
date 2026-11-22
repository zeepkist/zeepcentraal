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
            let row = sql_query(include_str!(
                "../queries/medals/refresh_medals_refresh_level_medals.sql"
            ))
            .bind::<Integer, _>(id_level)
            .get_result::<Refreshed>(&mut connection)
            .await?;
            return Ok(row.refreshed);
        }
        // Persistent deadlines survive worker restarts. Stable keys coalesce retries.
        sql_query(include_str!("../queries/medals/refresh_medals_enqueue.sql"))
            .execute(&mut connection)
            .await?;
        Ok(true)
    }
}
