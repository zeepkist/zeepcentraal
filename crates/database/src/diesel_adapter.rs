use crate::{Standing, User, LEADERBOARD_SQL};
use anyhow::Result;
use diesel::{
    sql_query,
    sql_types::{BigInt, Double, Integer},
};
use diesel_async::{
    pooled_connection::{bb8::Pool, AsyncDieselConnectionManager},
    AsyncConnection, AsyncPgConnection, RunQueryDsl,
};

#[derive(Clone)]
pub struct Database {
    pool: Pool<AsyncPgConnection>,
}
impl Database {
    pub const NAME: &'static str = "diesel";
    pub async fn connect(url: &str, max: u32) -> Result<Self> {
        let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(url);
        Ok(Self {
            pool: Pool::builder()
                .max_size(max)
                .min_idle(Some(0))
                .idle_timeout(Some(std::time::Duration::from_secs(30)))
                .connection_timeout(std::time::Duration::from_secs(5))
                .reaper_rate(std::time::Duration::from_secs(1))
                .build(manager)
                .await?,
        })
    }
    pub async fn user(&self, steam_id: i64) -> Result<Option<User>> {
        use diesel::{ExpressionMethods, OptionalExtension, QueryDsl, SelectableHelper};
        let mut conn = self.pool.get().await?;
        let row = schema::user::table
            .filter(schema::user::steam_id.eq(steam_id))
            .select(UserRow::as_select())
            .first(&mut conn)
            .await
            .optional()?;
        Ok(row.map(|row| User {
            id: row.id,
            steam_id: row.steam_id.to_string(),
            steam_name: row.steam_name,
            banned: row.banned,
        }))
    }

    pub async fn leaderboard(&self, level: i32, limit: i64) -> Result<Vec<Standing>> {
        let mut conn = self.pool.get().await?;
        Ok(sql_query(LEADERBOARD_SQL)
            .bind::<Integer, _>(level)
            .bind::<BigInt, _>(limit.clamp(1, 100))
            .load(&mut conn)
            .await?)
    }
    pub async fn submit(&self, user: i32, level: i32, time: f64) -> Result<()> {
        anyhow::ensure!(time.is_finite() && time > 0.0, "Invalid record time");
        #[derive(diesel::QueryableByName)]
        struct Id {
            #[diesel(sql_type = Integer)]
            id: i32,
        }
        let mut conn = self.pool.get().await?;
        conn.transaction::<_, anyhow::Error, _>(|conn| Box::pin(async move {
            let row: Id = sql_query("INSERT INTO public.record(id_user,id_level,time) VALUES ($1,$2,$3) RETURNING id")
                .bind::<Integer,_>(user).bind::<Integer,_>(level).bind::<Double,_>(time).get_result(conn).await?;
            sql_query("INSERT INTO public.record_audit(id_record) VALUES ($1)").bind::<Integer,_>(row.id).execute(conn).await?;
            Ok(())
        })).await
    }
}

mod schema {
    diesel::table! {
        public.user (id) {
            id -> Integer,
            steam_id -> BigInt,
            steam_name -> Text,
            banned -> Bool,
        }
    }
}
#[derive(diesel::Queryable, diesel::Selectable)]
#[diesel(table_name = schema::user)]
#[diesel(check_for_backend(diesel::pg::Pg))]
struct UserRow {
    id: i32,
    steam_id: i64,
    steam_name: String,
    banned: bool,
}
