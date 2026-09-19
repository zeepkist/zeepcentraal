use crate::Database;
use anyhow::{Result, ensure};
use diesel::{
    OptionalExtension, QueryableByName, sql_query,
    sql_types::{BigInt, Bool, Integer, Nullable, Text, Varchar},
};
use diesel_async::{AsyncConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub mod zsl;

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAccount {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Nullable<Varchar>)]
    pub steam_name: Option<String>,
    #[diesel(sql_type = Bool)]
    pub banned: bool,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub steam_id: Option<i64>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub discord_id: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, QueryableByName, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Level {
    #[diesel(sql_type = Integer)]
    pub id: i32,
    #[diesel(sql_type = Text)]
    pub hash: String,
    #[diesel(sql_type = Text)]
    pub xx_hash: String,
    #[diesel(sql_type = Bool)]
    pub adventure: bool,
    #[diesel(sql_type = Bool)]
    pub has_records: bool,
    #[diesel(sql_type = BigInt)]
    pub record_count: i64,
    #[diesel(sql_type = Bool)]
    pub publicly_visible: bool,
}

#[derive(Clone, Debug)]
pub struct AuthRecord<'a> {
    pub id_user: i32,
    pub access_token: &'a str,
    pub access_token_expiry: i64,
    pub refresh_token: &'a str,
    pub refresh_token_expiry: i64,
    pub provider: &'a str,
}

#[derive(QueryableByName)]
struct ReturnedId {
    #[diesel(sql_type = Integer)]
    id: i32,
}

#[derive(QueryableByName)]
struct MinimumVersion {
    #[diesel(sql_type = Nullable<Text>)]
    minimum: Option<String>,
}

#[derive(QueryableByName)]
struct LinkCodeExpiry {
    #[diesel(sql_type = Text)]
    expires_at: String,
}

impl Database {
    pub async fn get_user(&self, steam_id: i64) -> Result<Option<UserAccount>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT id,steam_name,banned,steam_id,discord_id FROM public.\"user\" WHERE steam_id=$1 LIMIT 1")
            .bind::<BigInt, _>(steam_id).get_result(&mut connection).await.optional()?)
    }

    pub async fn upsert_user(&self, steam_id: i64, steam_name: &str) -> Result<UserAccount> {
        ensure!(steam_id > 0, "Steam ID must be positive");
        ensure!(!steam_name.is_empty(), "Steam name must not be empty");
        let mut connection = self.connection().await?;
        Ok(sql_query("INSERT INTO public.\"user\"(steam_id,steam_name,banned,date_created,date_updated) VALUES ($1,$2,false,clock_timestamp(),clock_timestamp()) ON CONFLICT (steam_id) DO UPDATE SET steam_name=excluded.steam_name,date_updated=clock_timestamp() RETURNING id,steam_name,banned,steam_id,discord_id")
            .bind::<BigInt, _>(steam_id)
            .bind::<Varchar, _>(steam_name)
            .get_result(&mut connection)
            .await?)
    }

    pub async fn get_user_by_discord_id(&self, discord_id: i64) -> Result<Option<UserAccount>> {
        ensure!(discord_id > 0, "Discord ID must be positive");
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT id,steam_name,banned,steam_id,discord_id FROM public.\"user\" WHERE discord_id=$1 AND discord_id>0 LIMIT 1")
            .bind::<BigInt, _>(discord_id).get_result(&mut connection).await.optional()?)
    }

    pub async fn update_user_name(&self, steam_id: i64, name: &str) -> Result<bool> {
        let mut connection = self.connection().await?;
        Ok(sql_query("UPDATE public.\"user\" SET steam_name=$2,date_updated=clock_timestamp() WHERE steam_id=$1")
            .bind::<BigInt, _>(steam_id).bind::<Varchar, _>(name).execute(&mut connection).await? > 0)
    }

    pub async fn update_discord_id(&self, steam_id: i64, discord_id: Option<i64>) -> Result<bool> {
        let mut connection = self.connection().await?;
        Ok(sql_query("UPDATE public.\"user\" SET discord_id=$2,date_updated=clock_timestamp() WHERE steam_id=$1")
            .bind::<BigInt, _>(steam_id).bind::<Nullable<BigInt>, _>(discord_id).execute(&mut connection).await? > 0)
    }

    pub async fn create_discord_link_code(&self, id_user: i32, code_hash: &str) -> Result<String> {
        let mut connection = self.connection().await?;
        connection
            .transaction::<String, anyhow::Error, _>(|connection| {
                Box::pin(async move {
                    sql_query(
                        "DELETE FROM zc_private.discord_link_code \
                         WHERE id_user=$1 OR expires_at<clock_timestamp()",
                    )
                    .bind::<Integer, _>(id_user)
                    .execute(connection)
                    .await?;
                    let row: LinkCodeExpiry = sql_query(
                        "INSERT INTO zc_private.discord_link_code(code_hash,id_user,expires_at) \
                         VALUES($1,$2,clock_timestamp()+interval '10 minutes') \
                         RETURNING to_char(expires_at AT TIME ZONE 'UTC', \
                           'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS expires_at",
                    )
                    .bind::<Text, _>(code_hash)
                    .bind::<Integer, _>(id_user)
                    .get_result(connection)
                    .await?;
                    Ok(row.expires_at)
                })
            })
            .await
    }

    pub async fn unlink_discord_by_steam_id(&self, steam_id: i64) -> Result<bool> {
        let mut connection = self.connection().await?;
        Ok(sql_query(
            "UPDATE public.\"user\" SET discord_id=-1,date_updated=clock_timestamp() \
             WHERE steam_id=$1",
        )
        .bind::<BigInt, _>(steam_id)
        .execute(&mut connection)
        .await?
            > 0)
    }

    pub async fn get_level_by_xx_hash(&self, xx_hash: &str) -> Result<Option<Level>> {
        let mut connection = self.connection().await?;
        Ok(sql_query("SELECT id,hash,xx_hash,adventure,has_records,record_count,publicly_visible FROM public.level WHERE xx_hash=$1 LIMIT 1")
            .bind::<Text, _>(xx_hash).get_result(&mut connection).await.optional()?)
    }

    pub async fn add_favourite(&self, id_user: i32, id_level: i32) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("INSERT INTO public.favourite(id_user,id_level) VALUES ($1,$2) ON CONFLICT (id_user,id_level) DO NOTHING")
            .bind::<Integer, _>(id_user).bind::<Integer, _>(id_level).execute(&mut connection).await?;
        Ok(())
    }

    pub async fn remove_favourite(&self, id_user: i32, id_level: i32) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("DELETE FROM public.favourite WHERE id_user=$1 AND id_level=$2")
            .bind::<Integer, _>(id_user)
            .bind::<Integer, _>(id_level)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn upsert_vote(&self, id_user: i32, id_level: i32, value: i32) -> Result<()> {
        ensure!((-2..=2).contains(&value), "Vote must be between -2 and 2");
        let mut connection = self.connection().await?;
        sql_query("INSERT INTO public.vote(id_user,id_level,value) VALUES ($1,$2,$3) ON CONFLICT (id_user,id_level) DO UPDATE SET value=excluded.value,date_updated=clock_timestamp()")
            .bind::<Integer, _>(id_user).bind::<Integer, _>(id_level).bind::<Integer, _>(value).execute(&mut connection).await?;
        Ok(())
    }

    pub async fn claim_level_request(&self, workshop_id: i64, hash: &str) -> Result<bool> {
        ensure!(workshop_id > 0, "Workshop ID must be positive");
        let mut connection = self.connection().await?;
        let result = sql_query("INSERT INTO public.level_request(workshop_id,hash) VALUES ($1,$2) ON CONFLICT (workshop_id) DO NOTHING RETURNING id")
            .bind::<BigInt, _>(workshop_id).bind::<Text, _>(hash)
            .get_result::<ReturnedId>(&mut connection).await.optional()?;
        Ok(result.is_some())
    }

    pub async fn release_level_request(&self, workshop_id: i64) -> Result<()> {
        let mut connection = self.connection().await?;
        sql_query("DELETE FROM public.level_request WHERE workshop_id=$1")
            .bind::<BigInt, _>(workshop_id)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn is_mod_outdated(&self, current: &str) -> bool {
        let Ok(mut connection) = self.connection().await else {
            return true;
        };
        let minimum = sql_query("SELECT minimum FROM public.version LIMIT 1")
            .get_result::<MinimumVersion>(&mut connection)
            .await
            .optional();
        match minimum {
            Ok(Some(MinimumVersion {
                minimum: Some(minimum),
            })) => zc_core::version::is_mod_outdated(current, &minimum),
            Ok(_) => false,
            Err(_) => true,
        }
    }

    pub async fn insert_auth(&self, record: AuthRecord<'_>) -> Result<i32> {
        let refresh_hash = refresh_token_hash(record.refresh_token);
        let mut connection = self.connection().await?;
        let row: ReturnedId = sql_query("INSERT INTO public.auth(id_user,access_token,access_token_expiry,refresh_token,refresh_token_hash,refresh_token_expiry,type,provider,date_created,date_updated) VALUES ($1,$2,$3,NULL,$4,$5,0,$6,clock_timestamp(),clock_timestamp()) RETURNING id")
            .bind::<Integer, _>(record.id_user).bind::<Text, _>(record.access_token).bind::<BigInt, _>(record.access_token_expiry)
            .bind::<Text, _>(refresh_hash).bind::<BigInt, _>(record.refresh_token_expiry).bind::<Varchar, _>(record.provider)
            .get_result(&mut connection).await?;
        Ok(row.id)
    }

    pub async fn rotate_auth(
        &self,
        current_refresh_token: &str,
        next: AuthRecord<'_>,
    ) -> Result<bool> {
        let current_hash = refresh_token_hash(current_refresh_token);
        let next_hash = refresh_token_hash(next.refresh_token);
        let mut connection = self.connection().await?;
        connection.transaction::<bool, anyhow::Error, _>(|connection| Box::pin(async move {
            let deleted = sql_query("DELETE FROM public.auth WHERE id_user=$1 AND refresh_token_hash=$2 AND refresh_token_expiry>extract(epoch from clock_timestamp())::bigint")
                .bind::<Integer, _>(next.id_user).bind::<Text, _>(&current_hash).execute(connection).await?;
            if deleted == 0 { return Ok(false); }
            sql_query("INSERT INTO public.auth(id_user,access_token,access_token_expiry,refresh_token,refresh_token_hash,refresh_token_expiry,type,provider,date_created,date_updated) VALUES ($1,$2,$3,NULL,$4,$5,0,$6,clock_timestamp(),clock_timestamp())")
                .bind::<Integer, _>(next.id_user).bind::<Text, _>(next.access_token).bind::<BigInt, _>(next.access_token_expiry)
                .bind::<Text, _>(&next_hash).bind::<BigInt, _>(next.refresh_token_expiry).bind::<Varchar, _>(next.provider)
                .execute(connection).await?;
            Ok(true)
        })).await
    }
}

pub fn refresh_token_hash(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}

#[cfg(test)]
mod tests {
    #[test]
    fn refresh_tokens_use_lowercase_sha256() {
        assert_eq!(
            super::refresh_token_hash("test"),
            "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        );
    }
}
