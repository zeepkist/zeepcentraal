use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Nullable},
};
use diesel_async::RunQueryDsl;

const MISSING_SURFACE_TOTALS: &str =
    include_str!("../queries/surface_statistics/missing_surface_totals.sql");

#[derive(Debug, QueryableByName)]
pub struct SurfaceStatisticsRepairBatch {
    #[diesel(sql_type = BigInt)]
    pub processed: i64,
    #[diesel(sql_type = Nullable<Integer>)]
    pub before_id: Option<i32>,
}

#[derive(QueryableByName)]
struct UpperBound {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct Remaining {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

impl Database {
    pub async fn surface_statistics_upper_bound(&self) -> Result<i32> {
        let mut connection = self.connection().await?;
        // Bounded descending lookup; avoid an aggregate over the full table.
        let rows = sql_query(include_str!(
            "../queries/surface_statistics/surface_statistics_upper_bound.sql"
        ))
        .load::<UpperBound>(&mut connection)
        .await?;
        Ok(rows.into_iter().next().map_or(0, |row| row.id))
    }

    pub async fn remaining_surface_statistics(&self, through_id: i32) -> Result<i64> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            include_str!("../queries/surface_statistics/remaining_surface_statistics.sql").replace(
                "{{missing_surface_totals}}",
                MISSING_SURFACE_TOTALS.trim_end(),
            ),
        )
        .bind::<Integer, _>(through_id)
        .get_result::<Remaining>(&mut connection)
        .await?
        .count)
    }

    pub async fn repair_surface_statistics_batch(
        &self,
        through_id: i32,
        before_id: Option<i32>,
        limit: i64,
    ) -> Result<SurfaceStatisticsRepairBatch> {
        ensure!(
            (1..=500).contains(&limit),
            "surface repair limit is invalid"
        );
        let mut connection = self.connection().await?;
        // One statement is one transaction. Never replace existing Unknown or material totals.
        Ok(sql_query(
            include_str!("../queries/surface_statistics/repair_surface_statistics_batch.sql")
                .replace(
                    "{{missing_surface_totals}}",
                    MISSING_SURFACE_TOTALS.trim_end(),
                ),
        )
        .bind::<Integer, _>(through_id)
        .bind::<Nullable<Integer>, _>(before_id)
        .bind::<BigInt, _>(limit)
        .get_result(&mut connection)
        .await?)
    }
}
