use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    QueryableByName, sql_query,
    sql_types::{BigInt, Integer, Nullable},
};
use diesel_async::RunQueryDsl;

const MISSING_SURFACE_TOTALS: &str = "ghost_version IN (7,8) AND \
    ((distance_on_unknown IS NULL AND distance_on_ground IS NOT NULL) OR \
     (time_on_unknown IS NULL AND time_on_ground IS NOT NULL))";

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
        let rows = sql_query(
            "SELECT id_record AS id FROM public.record_statistic ORDER BY id_record DESC LIMIT 1",
        )
        .load::<UpperBound>(&mut connection)
        .await?;
        Ok(rows.into_iter().next().map_or(0, |row| row.id))
    }

    pub async fn remaining_surface_statistics(&self, through_id: i32) -> Result<i64> {
        let mut connection = self.connection().await?;
        Ok(sql_query(format!(
            "SELECT count(*) AS count FROM public.record_statistic WHERE id_record<=$1 AND {MISSING_SURFACE_TOTALS}"
        ))
        .bind::<Integer, _>(through_id)
        .get_result::<Remaining>(&mut connection).await?.count)
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
        Ok(sql_query(format!(r#"
            WITH candidates AS MATERIALIZED (
                SELECT id_record FROM public.record_statistic
                WHERE id_record<=$1 AND ($2::integer IS NULL OR id_record<$2)
                  AND {MISSING_SURFACE_TOTALS}
                ORDER BY id_record DESC LIMIT $3
            ), repaired AS (
                UPDATE public.record_statistic statistic SET
                    distance_on_unknown=CASE WHEN distance_on_unknown IS NULL AND distance_on_ground IS NOT NULL THEN
                        GREATEST(0::double precision, distance_on_ground::double precision -
                            (COALESCE(distance_on_tarmac,0)::double precision + COALESCE(distance_on_grass,0)::double precision +
                             COALESCE(distance_on_sand,0)::double precision + COALESCE(distance_on_soap,0)::double precision +
                             COALESCE(distance_on_wood,0)::double precision + COALESCE(distance_on_mud,0)::double precision +
                             COALESCE(distance_on_ice1,0)::double precision + COALESCE(distance_on_ice2,0)::double precision +
                             COALESCE(distance_on_ice3,0)::double precision))::real
                        ELSE distance_on_unknown END,
                    time_on_unknown=CASE WHEN time_on_unknown IS NULL AND time_on_ground IS NOT NULL THEN
                        GREATEST(0::double precision, time_on_ground::double precision -
                            (COALESCE(time_on_tarmac,0)::double precision + COALESCE(time_on_grass,0)::double precision +
                             COALESCE(time_on_sand,0)::double precision + COALESCE(time_on_soap,0)::double precision +
                             COALESCE(time_on_wood,0)::double precision + COALESCE(time_on_mud,0)::double precision +
                             COALESCE(time_on_ice1,0)::double precision + COALESCE(time_on_ice2,0)::double precision +
                             COALESCE(time_on_ice3,0)::double precision))::real
                        ELSE time_on_unknown END,
                    date_updated=clock_timestamp()
                FROM candidates WHERE statistic.id_record=candidates.id_record
                  AND ((statistic.distance_on_unknown IS NULL AND statistic.distance_on_ground IS NOT NULL)
                    OR (statistic.time_on_unknown IS NULL AND statistic.time_on_ground IS NOT NULL))
                RETURNING statistic.id_record
            )
            SELECT count(*) AS processed,
                (SELECT min(id_record) FROM candidates) AS before_id FROM repaired
        "#))
        .bind::<Integer, _>(through_id)
        .bind::<Nullable<Integer>, _>(before_id)
        .bind::<BigInt, _>(limit)
        .get_result(&mut connection).await?)
    }
}
