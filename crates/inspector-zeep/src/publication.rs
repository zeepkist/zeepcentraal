//! Validation feed delivery is independent of contest scanning and publication.
use crate::{
    discord::{DeliveryError, DiscordRest},
    validation::sha256,
};
use anyhow::{Context, Result};
use reqwest::Method;
use serde_json::{Value, json};

pub fn escape_text(text: &str) -> String {
    text.chars()
        .take(600)
        .flat_map(|c| match c {
            '@' => vec!['@', '\u{200b}'],
            '*' | '_' | '~' | '`' | '[' | ']' | '<' | '>' | '\\' => vec!['\\', c],
            '\n' | '\r' => vec![' '],
            _ => vec![c],
        })
        .collect()
}
pub fn notification_payload(row: &Value) -> Value {
    let id = row["id"].as_i64().unwrap_or_default();
    let marker = format!("zc-submission:{id}");
    let name = escape_text(row["name"].as_str().unwrap_or("Submitted level"));
    let round = escape_text(row["roundName"].as_str().unwrap_or("Zeepkist Super League"));
    let authors = row["authors"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(escape_text)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();
    let status = if row["withdrawn"] == true {
        "Withdrawn"
    } else if row["valid"] == true {
        "Valid"
    } else {
        "Validation failed"
    };
    let m = &row["measurements"];
    let modes = m["modes"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(escape_text)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "None".into());
    let failures = row["failures"]
        .as_array()
        .map(|a| {
            let mut text = a
                .iter()
                .take(20)
                .filter_map(Value::as_str)
                .map(escape_text)
                .collect::<Vec<_>>()
                .join("\n");
            if a.len() > 20 {
                text.push_str(&format!(
                    "\n… {} more; see full validation on ZeepCentraal.",
                    a.len() - 20
                ));
            }
            text
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "None".into());
    let text = format!("## {name}\n**{round}**\nBy {authors}\n**{status}**");
    let thumbnail = row["thumbnail"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|url| {
            if url.starts_with("https://") {
                url.to_owned()
            } else {
                format!("https://cdn.zeepki.st/{}", url.trim_start_matches('/'))
            }
        });
    let header = if let Some(url) = thumbnail {
        json!({"type":9,"components":[{"type":10,"content":text}],"accessory":{"type":11,"media":{"url":url}}})
    } else {
        json!({"type":10,"content":text})
    };
    let metrics = format!(
        "**Blocks:** {} · **Checkpoints:** {} · **Author time:** {}s\n**Modes:** {modes}\n**Workshop updated:** {}\n**Failures:**\n{failures}",
        m["blocks"],
        m["checkpoints"],
        m["authorTime"],
        escape_text(row["workshopUpdatedAt"].as_str().unwrap_or("Unknown"))
    );
    let workshop = row["workshopId"].as_str().unwrap_or_default();
    let site = row["levelHash"]
        .as_str()
        .map(|hash| format!("https://zeepki.st/level/{hash}"))
        .unwrap_or_else(|| {
            format!(
                "https://zeepki.st/super-league/submit-level?roundId={}",
                row["roundId"]
            )
        });
    json!({"flags":32768,"allowed_mentions":{"parse":[]},"components":[{"type":17,"components":[header,{"type":14},{"type":10,"content":metrics},{"type":1,"components":[{"type":2,"style":5,"label":"Steam Workshop","url":format!("https://steamcommunity.com/sharedfiles/filedetails/?id={workshop}")},{"type":2,"style":5,"label":"ZeepCentraal","url":site}]},{"type":10,"content":format!("-# {marker}")}]}]})
}
async fn deliver(
    database: &zc_database::Database,
    discord: &DiscordRest,
    channel: &str,
    row: &Value,
) -> Result<()> {
    let id = row["id"].as_i64().context("Notification ID missing")?;
    let revision = row["revision"]
        .as_i64()
        .context("Notification revision missing")?;
    let validation = row["validationId"].as_i64();
    let payload = notification_payload(row);
    let digest = sha256(&serde_json::to_vec(&payload)?);
    let mut message = row["messageId"].as_str().map(str::to_owned);
    if message.is_none() && row["withdrawn"] == true && row["uncertain"] != true {
        return database
            .finish_submission_notification(id, revision, validation, None, &digest)
            .await;
    }
    if message.is_none() && row["uncertain"] == true {
        message = discord
            .recover_message(channel, &format!("zc-submission:{id}"))
            .await?;
    }
    if let Some(existing) = message.as_deref() {
        // Check existence even for unchanged payloads so deleted messages are recreated.
        let result = if row["digest"].as_str() == Some(&digest) {
            discord
                .request(
                    &format!("channels/{channel}/messages/{existing}"),
                    Method::GET,
                    None,
                )
                .await
        } else {
            discord
                .request(
                    &format!("channels/{channel}/messages/{existing}"),
                    Method::PATCH,
                    Some(&payload),
                )
                .await
        };
        match result {
            Ok(_) => {
                return database
                    .finish_submission_notification(
                        id,
                        revision,
                        validation,
                        Some(existing),
                        &digest,
                    )
                    .await;
            }
            Err(e)
                if e.downcast_ref::<DeliveryError>()
                    .is_some_and(|e| e.status == 404) =>
            {
                message = None;
            }
            Err(e) => return Err(e),
        }
    }
    if message.is_none() && row["withdrawn"] == true {
        return database
            .finish_submission_notification(id, revision, validation, None, &digest)
            .await;
    }
    database.begin_submission_notification(id).await?;
    let mut create = payload;
    create["nonce"] = format!("zcs{id}").into();
    create["enforce_nonce"] = true.into();
    let saved = discord
        .request(
            &format!("channels/{channel}/messages"),
            Method::POST,
            Some(&create),
        )
        .await?;
    let message = saved["id"].as_str().context("Discord message omitted ID")?;
    database
        .finish_submission_notification(id, revision, validation, Some(message), &digest)
        .await
}
pub async fn deliver_notifications(
    database: &zc_database::Database,
    discord: &DiscordRest,
    channel: &str,
) -> Result<()> {
    for row in database.pending_submission_notifications().await? {
        if let Err(error) = deliver(database, discord, channel, &row).await {
            let delay = error
                .downcast_ref::<DeliveryError>()
                .map_or(60, |e| e.retry_after);
            database
                .retry_submission_notification(
                    row["id"].as_i64().context("Notification ID missing")?,
                    delay,
                )
                .await?;
            tracing::warn!(submission_id=row["id"].as_i64(),%error,"Validation notification deferred");
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn components_v2_contract() {
        let p = notification_payload(
            &json!({"id":42,"name":"@everyone **name**","roundName":"Round","authors":["<@123>"],"thumbnail":"https://example.com/image.jpg","workshopId":"123","roundId":50,"valid":true,"measurements":{"blocks":100,"checkpoints":4,"authorTime":20,"modes":["Logic"]},"failures":[]}),
        );
        assert_eq!(p["flags"], 32768);
        assert!(p.get("content").is_none());
        assert!(p.get("embeds").is_none());
        assert_eq!(p["allowed_mentions"]["parse"], json!([]));
        assert!(p.to_string().contains("zc-submission:42"));
        assert!(!p.to_string().contains("@everyone"));
    }
}
