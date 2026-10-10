use anyhow::{Context, Result, ensure};
use rand::seq::SliceRandom;
use serde_json::Value;
use std::{collections::HashSet, time::Duration};
use zc_core::practice::{PracticeLevel, PracticePlaylist};

const QUERY: &str = r#"query ZslWarmup($since: Datetime!) {
  hotLevelsSince(first: 50, since: $since, filter: {
    publiclyVisible: {equalTo: true}, levelItems: {some: {
      deleted: {equalTo: false}, validationTimeAuthor: {greaterThanOrEqualTo: 20, lessThanOrEqualTo: 40}
    }}
  }) { nodes { xxHash levelPoints { points } levelItems(first: 1, orderBy: [UPDATED_AT_DESC], filter: {
    deleted: {equalTo: false}, validationTimeAuthor: {greaterThanOrEqualTo: 20, lessThanOrEqualTo: 40}
  }) { nodes { fileUid workshopId name fileAuthor validationTimeAuthor } } } }
}"#;

pub async fn fetch() -> Result<PracticePlaylist> {
    let since = jiff::Timestamp::from_second(jiff::Timestamp::now().as_second() - 30 * 86400)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;
    let mut response = client
        .post("https://graphql.zeepki.st")
        .json(&serde_json::json!({"query":QUERY,"variables":{"since":since.to_string()}}))
        .send()
        .await?
        .error_for_status()?;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        ensure!(
            bytes.len() + chunk.len() <= 2 * 1024 * 1024,
            "Warm-up GraphQL response too large"
        );
        bytes.extend_from_slice(&chunk);
    }
    let response: Value = serde_json::from_slice(&bytes)?;
    ensure!(
        response.get("errors").is_none(),
        "Warm-up GraphQL query failed"
    );
    let mut candidates = candidates(&response)?;
    candidates.sort_by_key(|(points, _)| std::cmp::Reverse(*points));
    candidates.truncate(20);
    candidates.shuffle(&mut rand::rng());
    Ok(PracticePlaylist {
        round_length: Some(300),
        levels: candidates
            .into_iter()
            .take(4)
            .map(|(_, level)| level)
            .collect(),
    })
}

fn candidates(response: &Value) -> Result<Vec<(i64, PracticeLevel)>> {
    let nodes = response
        .pointer("/data/hotLevelsSince/nodes")
        .and_then(Value::as_array)
        .context("Warm-up GraphQL response missing levels")?;
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for node in nodes {
        let Some(item) = node.pointer("/levelItems/nodes/0") else {
            continue;
        };
        let Some(hash) = node["xxHash"].as_str() else {
            continue;
        };
        let Some(author_time) = item["validationTimeAuthor"].as_f64() else {
            continue;
        };
        if !(20.0..=40.0).contains(&author_time) || !seen.insert(hash.to_owned()) {
            continue;
        }
        let Some(uid) = item["fileUid"].as_str() else {
            continue;
        };
        let workshop_id = item["workshopId"]
            .as_str()
            .and_then(|id| id.parse::<u64>().ok())
            .or_else(|| item["workshopId"].as_u64());
        let Some(workshop_id) = workshop_id.filter(|id| *id > 0) else {
            continue;
        };
        let Some(points) = node.pointer("/levelPoints/points").and_then(Value::as_i64) else {
            continue;
        };
        result.push((
            points,
            PracticeLevel {
                uid: uid.to_owned(),
                workshop_id,
                name: item["name"].as_str().unwrap_or_default().to_owned(),
                author: item["fileAuthor"].as_str().unwrap_or_default().to_owned(),
                collaborators: String::new(),
                override_author_name: String::new(),
            },
        ));
    }
    ensure!(result.len() >= 4, "Not enough downloadable warm-up levels");
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_missing_and_short_pool() {
        assert!(candidates(&serde_json::json!({})).is_err());
        assert!(candidates(&serde_json::json!({"data":{"hotLevelsSince":{"nodes":[]}}})).is_err());
    }
}
