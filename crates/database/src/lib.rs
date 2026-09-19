//! Domain-level evaluation boundary, selected at compile time.
#[cfg(all(feature = "db-sqlx", feature = "db-diesel"))]
compile_error!("Select exactly one database adapter");
#[cfg(not(any(feature = "db-sqlx", feature = "db-diesel")))]
compile_error!("Select db-sqlx or db-diesel");

#[cfg(feature = "db-diesel")]
mod diesel_adapter;
pub mod history;
pub mod migration;
#[cfg(feature = "db-sqlx")]
mod sqlx_adapter;

#[cfg(feature = "db-diesel")]
pub use diesel_adapter::Database;
#[cfg(feature = "db-sqlx")]
pub use sqlx_adapter::Database;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[cfg_attr(feature = "db-sqlx", derive(sqlx::FromRow))]
#[cfg_attr(feature = "db-diesel", derive(diesel::QueryableByName))]
#[serde(rename_all = "camelCase")]
pub struct User {
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Integer))]
    pub id: i32,
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Text))]
    pub steam_id: String,
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Text))]
    pub steam_name: String,
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Bool))]
    pub banned: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[cfg_attr(feature = "db-sqlx", derive(sqlx::FromRow))]
#[cfg_attr(feature = "db-diesel", derive(diesel::QueryableByName))]
#[serde(rename_all = "camelCase")]
pub struct Standing {
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Integer))]
    pub id_user: i32,
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Text))]
    pub steam_name: String,
    #[cfg_attr(feature = "db-diesel", diesel(sql_type = diesel::sql_types::Double))]
    pub time: f64,
}

pub const USER_SQL: &str =
    "SELECT id, steam_id::text, steam_name, banned FROM public.\"user\" WHERE steam_id=$1";
pub const LEADERBOARD_SQL: &str = "SELECT r.id_user,u.steam_name,min(r.time) AS time FROM public.record r JOIN public.\"user\" u ON u.id=r.id_user WHERE r.id_level=$1 AND NOT u.banned GROUP BY r.id_user,u.steam_name ORDER BY time,r.id_user LIMIT $2";
