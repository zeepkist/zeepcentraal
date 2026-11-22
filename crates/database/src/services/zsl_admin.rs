use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Jsonb, Nullable, Text},
};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use zc_core::practice::PracticeBundle;

#[derive(Debug)]
pub struct ZslAdminConflict;
impl std::fmt::Display for ZslAdminConflict {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Record changed, is locked, or conflicts with an existing record. Refresh before saving.")
    }
}
impl std::error::Error for ZslAdminConflict {}

#[derive(Debug)]
pub struct ZslAdminValidation(pub String);
impl std::fmt::Display for ZslAdminValidation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}
impl std::error::Error for ZslAdminValidation {}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdminSave {
    pub id: Option<i32>,
    pub version: Option<String>,
    pub settings: AdminSettings,
}

#[derive(Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "lowercase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum AdminSettings {
    Points {
        name: String,
        points: Vec<i32>,
        minimum_points: i32,
        best_of: i32,
    },
    Season {
        name: String,
        points_structure_id: i32,
        start_date: String,
        end_date: String,
    },
    Round {
        name: String,
        season_id: i32,
        number: i32,
        workshop_id: Option<String>,
        steam_announcement_id: Option<String>,
        event_date: String,
        event2_date: Option<String>,
        submission_start: Option<String>,
        submission_end: Option<String>,
        zsl_vote_end: Option<String>,
        cosmetic_vote_end: Option<String>,
    },
}

fn timestamp(value: &str) -> Result<jiff::Timestamp> {
    value.parse().map_err(|_| {
        ZslAdminValidation("Use a timestamp with an explicit UTC offset".into()).into()
    })
}

impl AdminSettings {
    fn validate(&self, creating: bool) -> Result<()> {
        let name = match self {
            Self::Points {
                name,
                points,
                minimum_points,
                best_of,
            } => {
                ensure!(
                    !points.is_empty()
                        && points.iter().all(|p| p >= minimum_points)
                        && points.windows(2).all(|pair| pair[0] >= pair[1])
                        && *minimum_points >= 0
                        && *best_of > 0,
                    ZslAdminValidation(
                        "Use descending, non-negative points and a positive best-of count".into()
                    )
                );
                name
            }
            Self::Season {
                name,
                points_structure_id,
                start_date,
                end_date,
            } => {
                ensure!(
                    *points_structure_id > 0 && timestamp(start_date)? < timestamp(end_date)?,
                    ZslAdminValidation(
                        "Select a points structure and set the end after the start".into()
                    )
                );
                name
            }
            Self::Round {
                name,
                season_id,
                number,
                workshop_id,
                steam_announcement_id,
                event_date,
                event2_date,
                submission_start,
                submission_end,
                zsl_vote_end,
                cosmetic_vote_end,
            } => {
                ensure!(
                    *season_id > 0 && *number > 0,
                    ZslAdminValidation("Select a season and a positive round number".into())
                );
                for (id, minimum) in [(workshop_id, 0), (steam_announcement_id, 1)] {
                    ensure!(
                        id.as_ref()
                            .is_none_or(|id| id.parse::<i64>().is_ok_and(|id| id >= minimum)),
                        ZslAdminValidation("Invalid Workshop or Steam announcement ID".into())
                    );
                }
                let first = timestamp(event_date)?.as_second();
                let second = event2_date
                    .as_deref()
                    .map(timestamp)
                    .transpose()?
                    .map(|time| time.as_second());
                ensure!(
                    second.is_none_or(|second| second - first >= 20 * 60 + 15 * 420),
                    ZslAdminValidation("Timeslot 2 warmup must start after Timeslot 1 ends".into())
                );
                let now = jiff::Timestamp::now().as_second();
                ensure!(
                    !creating || first > now + 20 * 60,
                    ZslAdminValidation("Set the first timeslot before its warmup begins".into())
                );
                let dates = [
                    submission_start,
                    submission_end,
                    zsl_vote_end,
                    cosmetic_vote_end,
                ];
                if dates.iter().any(|date| date.is_some()) {
                    let dates = dates
                        .into_iter()
                        .map(|date| {
                            timestamp(date.as_deref().ok_or_else(|| {
                                ZslAdminValidation("Set all four contest dates".into())
                            })?)
                        })
                        .collect::<Result<Vec<_>>>()?;
                    ensure!(
                        dates[0] < dates[1] && dates[1] < dates[2] && dates[2] <= dates[3],
                        ZslAdminValidation(
                            "Set contest dates in submission and voting order".into()
                        )
                    );
                    ensure!(
                        !creating || dates[0].as_second() > now,
                        ZslAdminValidation("Set submission start in the future".into())
                    );
                }
                name
            }
        };
        ensure!(
            !name.trim().is_empty() && name.len() <= 256,
            ZslAdminValidation("Enter a name of 1 to 256 UTF-8 bytes".into())
        );
        Ok(())
    }

    fn statements(&self) -> (&'static str, &'static str, &'static str, &'static str) {
        match self {
            Self::Points { .. } => (
                "points",
                "points",
                include_str!("../queries/zsl_admin/points_insert.sql"),
                include_str!("../queries/zsl_admin/points_update.sql"),
            ),
            Self::Season { .. } => (
                "season",
                "seasons",
                include_str!("../queries/zsl_admin/season_insert.sql"),
                include_str!("../queries/zsl_admin/season_update.sql"),
            ),
            Self::Round { .. } => (
                "round",
                "rounds",
                include_str!("../queries/zsl_admin/round_insert.sql"),
                include_str!("../queries/zsl_admin/round_update.sql"),
            ),
        }
    }
}

#[derive(QueryableByName)]
struct JsonRow {
    #[diesel(sql_type = Jsonb)]
    value: Value,
}
#[derive(QueryableByName)]
struct IdRow {
    #[diesel(sql_type = Integer)]
    id: i32,
}
#[derive(QueryableByName)]
struct Locked {
    #[diesel(sql_type = Bool)]
    locked: bool,
}

#[derive(QueryableByName)]
pub struct PlaylistJob {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Integer)]
    pub round_id: i32,
    #[diesel(sql_type = Text)]
    pub kind: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub source: Option<String>,
    #[diesel(sql_type = Text)]
    pub attempt: String,
}

#[derive(QueryableByName)]
pub struct HostPlaylist {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Text)]
    pub kind: String,
    #[diesel(sql_type = Text)]
    pub state: String,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub value: Option<Value>,
    #[diesel(sql_type = BigInt)]
    pub updated_epoch: i64,
}

#[derive(QueryableByName)]
pub struct ReadinessAlert {
    #[diesel(sql_type = Integer)]
    pub round_id: i32,
    #[diesel(sql_type = Integer)]
    pub timeslot: i32,
    #[diesel(sql_type = Text)]
    pub starts_at: String,
    #[diesel(sql_type = Integer)]
    pub hours: i32,
}

async fn dashboard(connection: &mut AsyncPgConnection) -> Result<Value> {
    Ok(
        sql_query(include_str!("../queries/zsl_admin/dashboard.sql"))
            .get_result::<JsonRow>(connection)
            .await?
            .value,
    )
}

async fn lock_admin(connection: &mut AsyncPgConnection) -> Result<()> {
    sql_query(include_str!("../queries/zsl_admin/lock_admin.sql"))
        .execute(connection)
        .await?;
    Ok(())
}

async fn audit(
    connection: &mut AsyncPgConnection,
    entity: &str,
    id: i32,
    actor: i64,
    previous: Option<Value>,
    current: Value,
) -> Result<()> {
    sql_query(include_str!("../queries/zsl_admin/audit.sql"))
        .bind::<Text, _>(entity)
        .bind::<Integer, _>(id)
        .bind::<BigInt, _>(actor)
        .bind::<Nullable<Jsonb>, _>(previous)
        .bind::<Jsonb, _>(current)
        .execute(connection)
        .await?;
    Ok(())
}

impl Database {
    pub async fn zsl_admin_dashboard(&self) -> Result<Value> {
        dashboard(&mut *self.connection().await?).await
    }

    pub async fn save_zsl_admin(&self, actor: i64, save: AdminSave) -> Result<i32> {
        save.settings.validate(save.id.is_none())?;
        ensure!(
            save.id.is_some() == save.version.is_some(),
            ZslAdminValidation("Version is required when editing".into())
        );
        if let Some(version) = &save.version {
            timestamp(version)?;
        }
        let (entity, collection, insert, update) = save.settings.statements();
        let settings = serde_json::to_value(save.settings)?;
        self.connection()
            .await?
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                lock_admin(connection).await?;
                let previous = if let Some(id) = save.id {
                    dashboard(connection).await?[collection]
                        .as_array()
                        .and_then(|rows| rows.iter().find(|row| row["id"] == id))
                        .cloned()
                } else {
                    None
                };
                let row = if let Some((id, version)) = save.id.zip(save.version) {
                    sql_query(update)
                        .bind::<Jsonb, _>(&settings)
                        .bind::<Integer, _>(id)
                        .bind::<Text, _>(version)
                        .get_result::<IdRow>(connection)
                        .await
                        .optional()?
                } else {
                    sql_query(insert)
                        .bind::<Jsonb, _>(&settings)
                        .get_result::<IdRow>(connection)
                        .await
                        .optional()?
                }
                .ok_or(ZslAdminConflict)?;
                audit(connection, entity, row.id, actor, previous, settings).await?;
                if entity == "round" {
                    sql_query(include_str!("../queries/zsl_admin/default_warmup.sql"))
                        .bind::<Integer, _>(row.id)
                        .execute(connection)
                        .await?;
                }
                Ok(row.id)
            })
            .await
    }

    pub async fn zsl_playlist_status(&self, round_id: i32) -> Result<Value> {
        Ok(
            sql_query(include_str!("../queries/zsl_admin/playlist_status.sql"))
                .bind::<Integer, _>(round_id)
                .get_result::<JsonRow>(&mut self.connection().await?)
                .await?
                .value,
        )
    }

    pub async fn request_zsl_playlist(
        &self,
        actor: i64,
        round_id: i32,
        kind: &str,
        source: Option<String>,
        retry: Option<i32>,
    ) -> Result<i32> {
        let kind = kind.to_owned();
        self.connection()
            .await?
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                lock_admin(connection).await?;
                sql_query(include_str!("../queries/zsl_admin/round_playlist_lock.sql"))
                    .bind::<Integer, _>(round_id)
                    .get_result::<IdRow>(connection)
                    .await
                    .optional()?
                    .ok_or(ZslAdminConflict)?;
                let (revision, kind) = if let Some(revision) = retry {
                    #[derive(QueryableByName)]
                    struct Retried {
                        #[diesel(sql_type = Integer)]
                        id: i32,
                        #[diesel(sql_type = Text)]
                        kind: String,
                    }
                    let row = sql_query(include_str!("../queries/zsl_admin/retry_playlist.sql"))
                        .bind::<Integer, _>(revision)
                        .bind::<Integer, _>(round_id)
                        .get_result::<Retried>(connection)
                        .await
                        .optional()?
                        .ok_or(ZslAdminConflict)?;
                    (row.id, row.kind)
                } else {
                    let row = sql_query(include_str!("../queries/zsl_admin/request_playlist.sql"))
                        .bind::<Integer, _>(round_id)
                        .bind::<Text, _>(&kind)
                        .bind::<Nullable<Text>, _>(source)
                        .get_result::<IdRow>(connection)
                        .await?;
                    (row.id, kind)
                };
                if kind == "tournament" {
                    let locked =
                        sql_query(include_str!("../queries/zsl_admin/protect_tournament.sql"))
                            .bind::<Integer, _>(round_id)
                            .get_result::<Locked>(connection)
                            .await?
                            .locked;
                    ensure!(!locked, ZslAdminConflict);
                }
                audit(
                    connection,
                    &kind,
                    round_id,
                    actor,
                    None,
                    json!({"revision":revision,"retried":retry}),
                )
                .await?;
                Ok(revision)
            })
            .await
    }

    pub async fn pending_zsl_playlists(connection: &mut AsyncPgConnection) -> Result<Vec<i32>> {
        Ok(sql_query(include_str!("../queries/zsl_admin/pending.sql"))
            .load::<IdRow>(connection)
            .await?
            .into_iter()
            .map(|row| row.id)
            .collect())
    }

    pub async fn claim_zsl_playlist(&self, revision: i32) -> Result<Option<PlaylistJob>> {
        Ok(
            sql_query(include_str!("../queries/zsl_admin/claim_playlist.sql"))
                .bind::<Integer, _>(revision)
                .get_result(&mut self.connection().await?)
                .await
                .optional()?,
        )
    }

    pub async fn finish_zsl_playlist(
        &self,
        job: &PlaylistJob,
        bundle: Option<&PracticeBundle>,
        diagnostics: Value,
    ) -> Result<()> {
        let id = job.id;
        let attempt = job.attempt.clone();
        let bundle = bundle.map(serde_json::to_value).transpose()?;
        self.connection()
            .await?
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!("../queries/zsl_admin/lock_revision_round.sql"))
                    .bind::<Integer, _>(id)
                    .get_result::<IdRow>(connection)
                    .await?;
                sql_query(include_str!("../queries/zsl_admin/finish_playlist.sql"))
                    .bind::<Integer, _>(id)
                    .bind::<Text, _>(attempt)
                    .bind::<Nullable<Jsonb>, _>(bundle)
                    .bind::<Jsonb, _>(diagnostics)
                    .execute(connection)
                    .await?;
                Ok(())
            })
            .await
    }

    pub async fn zsl_playlist_progress(&self, job: &PlaylistJob, diagnostics: Value) -> Result<()> {
        sql_query(include_str!("../queries/zsl_admin/playlist_progress.sql"))
            .bind::<Integer, _>(job.id)
            .bind::<Text, _>(&job.attempt)
            .bind::<Jsonb, _>(diagnostics)
            .execute(&mut self.connection().await?)
            .await?;
        Ok(())
    }

    pub async fn host_zsl_playlists(
        &self,
        round_id: i32,
        latest: bool,
    ) -> Result<Vec<HostPlaylist>> {
        Ok(
            sql_query(include_str!("../queries/zsl_admin/host_playlists.sql"))
                .bind::<Integer, _>(round_id)
                .bind::<Bool, _>(latest)
                .load(&mut self.connection().await?)
                .await?,
        )
    }

    pub async fn host_zsl_practice_playlists(&self, round_id: i32) -> Result<Vec<HostPlaylist>> {
        Ok(sql_query(include_str!(
            "../queries/zsl_admin/host_practice_playlists.sql"
        ))
        .bind::<Integer, _>(round_id)
        .load(&mut self.connection().await?)
        .await?)
    }

    pub async fn zsl_tournament_source(&self, round_id: i32) -> Result<Option<String>> {
        #[derive(QueryableByName)]
        struct Source {
            #[diesel(sql_type = Text)]
            value: String,
        }
        Ok(
            sql_query(include_str!("../queries/zsl_admin/tournament_source.sql"))
                .bind::<Integer, _>(round_id)
                .get_result::<Source>(&mut self.connection().await?)
                .await
                .optional()?
                .map(|row| row.value),
        )
    }

    pub async fn verify_zsl_playlist(&self, revision: i32, failure: Option<Value>) -> Result<bool> {
        self.connection()
            .await?
            .transaction::<_, anyhow::Error, _>(async move |connection| {
                sql_query(include_str!("../queries/zsl_admin/lock_revision_round.sql"))
                    .bind::<Integer, _>(revision)
                    .get_result::<IdRow>(connection)
                    .await?;
                Ok(
                    sql_query(include_str!("../queries/zsl_admin/verify_playlist.sql"))
                        .bind::<Integer, _>(revision)
                        .bind::<Nullable<Jsonb>, _>(failure)
                        .execute(connection)
                        .await?
                        == 1,
                )
            })
            .await
    }

    pub async fn zsl_readiness_alerts(
        connection: &mut AsyncPgConnection,
    ) -> Result<Vec<ReadinessAlert>> {
        Ok(sql_query(include_str!("../queries/zsl_admin/alerts.sql"))
            .load(connection)
            .await?)
    }
}
