use serde_json::{Value, json};

pub const COMPONENTS_V2_FLAG: u64 = 1 << 15;

pub fn playlist_message(filename: &str, valid_count: usize, updated_at_epoch: i64) -> Value {
    json!({
        "flags": COMPONENTS_V2_FLAG,
        "allowed_mentions": { "parse": [] },
        "components": [{
            "type": 17,
            "components": [
                {
                    "type": 10,
                    "content": format!(
                        "## Level contest submissions\n{valid_count} valid submissions · Updated <t:{updated_at_epoch}:R>"
                    )
                },
                { "type": 13, "file": { "url": format!("attachment://{filename}") } }
            ]
        }]
    })
}

pub fn publication_filename(thread_id: &str, digest: &str) -> String {
    format!("contest-{thread_id}-{digest}.zeeplist")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_components_v2_attachment_contract() {
        let message = playlist_message("contest.zeeplist", 3, 1_757_462_400);
        assert_eq!(message["flags"], COMPONENTS_V2_FLAG);
        assert_eq!(
            message.pointer("/components/0/components/1/file/url"),
            Some(&json!("attachment://contest.zeeplist"))
        );
        assert_eq!(
            publication_filename("3", "revision"),
            "contest-3-revision.zeeplist"
        );
    }
}
