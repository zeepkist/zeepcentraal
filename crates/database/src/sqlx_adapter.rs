use crate::{Standing, User, LEADERBOARD_SQL, USER_SQL};
use anyhow::Result;
use sqlx::PgPool;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}
impl Database {
    pub const NAME: &'static str = "sqlx";
    pub async fn connect(url: &str, max: u32) -> Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(max)
            .min_connections(0)
            .idle_timeout(std::time::Duration::from_secs(30))
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect(url)
            .await?;
        Ok(Self { pool })
    }
    pub async fn user(&self, steam_id: i64) -> Result<Option<User>> {
        Ok(sqlx::query_as(USER_SQL)
            .bind(steam_id)
            .fetch_optional(&self.pool)
            .await?)
    }
    pub async fn leaderboard(&self, level: i32, limit: i64) -> Result<Vec<Standing>> {
        Ok(sqlx::query_as(LEADERBOARD_SQL)
            .bind(level)
            .bind(limit.clamp(1, 100))
            .fetch_all(&self.pool)
            .await?)
    }
    /// Evaluation transaction: insert a record and its audit event atomically.
    pub async fn submit(&self, user: i32, level: i32, time: f64) -> Result<()> {
        anyhow::ensure!(time.is_finite() && time > 0.0, "Invalid record time");
        let mut tx = self.pool.begin().await?;
        let id: i32 = sqlx::query_scalar(
            "INSERT INTO public.record(id_user,id_level,time) VALUES ($1,$2,$3) RETURNING id",
        )
        .bind(user)
        .bind(level)
        .bind(time)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO public.record_audit(id_record) VALUES ($1)")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }
}
