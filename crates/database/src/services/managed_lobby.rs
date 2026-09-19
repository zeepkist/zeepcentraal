use crate::Database;
use anyhow::{Result, ensure};
use diesel::{OptionalExtension, QueryableByName, sql_query, sql_types::Text};
use diesel_async::RunQueryDsl;

#[derive(QueryableByName)]
struct JoinIdRow {
    #[diesel(sql_type = Text)]
    join_id: String,
}

impl Database {
    pub async fn managed_lobby_join_id(&self, key: &str) -> Result<Option<String>> {
        validate_key(key)?;
        let mut connection = self.connection().await?;
        Ok(
            sql_query("SELECT join_id FROM zc_private.managed_lobby WHERE key=$1 LIMIT 1")
                .bind::<Text, _>(key)
                .get_result::<JoinIdRow>(&mut connection)
                .await
                .optional()?
                .map(|row| row.join_id),
        )
    }

    pub async fn set_managed_lobby_join_id(&self, key: &str, join_id: &str) -> Result<()> {
        validate_key(key)?;
        ensure!(
            !join_id.is_empty() && join_id.len() <= 1_024,
            "Invalid managed lobby join ID"
        );
        let mut connection = self.connection().await?;
        sql_query(
            "INSERT INTO zc_private.managed_lobby(key,join_id,date_created,date_updated) \
             VALUES($1,$2,clock_timestamp(),clock_timestamp()) \
             ON CONFLICT(key) DO UPDATE SET join_id=excluded.join_id,date_updated=clock_timestamp()",
        )
        .bind::<Text, _>(key)
        .bind::<Text, _>(join_id)
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    pub async fn clear_managed_lobby_join_id(&self, key: &str) -> Result<bool> {
        validate_key(key)?;
        let mut connection = self.connection().await?;
        Ok(
            sql_query("DELETE FROM zc_private.managed_lobby WHERE key=$1")
                .bind::<Text, _>(key)
                .execute(&mut connection)
                .await?
                > 0,
        )
    }
}

fn validate_key(key: &str) -> Result<()> {
    ensure!(
        !key.is_empty()
            && key.len() <= 64
            && key.bytes().all(|byte| byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || byte == b'_'
                || byte == b'-')
            && key
                .as_bytes()
                .first()
                .is_some_and(u8::is_ascii_alphanumeric)
            && key.as_bytes().last().is_some_and(u8::is_ascii_alphanumeric),
        "Invalid managed lobby key"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_key;

    #[test]
    fn validates_managed_room_keys() {
        assert!(validate_key("totw").is_ok());
        assert!(validate_key("zsl_submissions-2").is_ok());
        for key in ["", "BAD", "-bad", "bad-", "bad key"] {
            assert!(validate_key(key).is_err(), "accepted {key}");
        }
    }
}
