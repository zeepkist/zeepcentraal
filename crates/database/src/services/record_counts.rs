use anyhow::Result;
use diesel::{
    sql_query,
    sql_types::{Array, Integer},
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};

impl crate::Database {
    pub async fn mark_user_medal_counts_dirty(&self, users: &[i32]) -> Result<()> {
        sql_query(include_str!(
            "../queries/record_counts/mark_user_medal_counts_dirty.sql"
        ))
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
    sql_query(include_str!(
        "../queries/record_counts/insert_user_points.sql"
    ))
    .bind::<Array<Integer>, _>(users)
    .execute(connection)
    .await?;
    sql_query(include_str!(
        "../queries/record_counts/refresh_user_record_counts_refresh_dirty_user_medal_counts.sql"
    ))
    .bind::<Array<Integer>, _>(users)
    .execute(connection)
    .await?;
    Ok(())
}
