use regex::Regex;
use std::{collections::HashMap, sync::LazyLock};

static ANSI_SEQUENCE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\x1b\[[0-?]*[ -/]*[@-~]").expect("valid ANSI sequence pattern"));
static CONTROL_OR_FORMAT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\p{Cc}\p{Cf}]").expect("valid control pattern"));
static WHITESPACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+").expect("valid whitespace pattern"));
static BEARER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)Bearer\s+[^\s,;]+").expect("valid bearer token pattern"));
static DATABASE_URL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(postgres(?:ql)?://)[^@\s]+@").expect("valid database URL pattern")
});
static QUERY_SECRET: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)([?&](?:access[_-]?token|api[_-]?key|key|password|secret|signature|token)=)[^&\s]+",
    )
    .expect("valid query secret pattern")
});
static FIELD_SECRET: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)(\b(?:access[_-]?token|api[_-]?key|password|secret|signature|token)=)[^\s,;&]+",
    )
    .expect("valid field secret pattern")
});

fn sanitize_audit_text(value: &str, max_utf16_units: usize, fallback: &str) -> String {
    let without_ansi = ANSI_SEQUENCE.replace_all(value, "");
    let without_controls = CONTROL_OR_FORMAT.replace_all(&without_ansi, " ");
    let normalized = WHITESPACE.replace_all(&without_controls, " ");
    let mut result = String::new();
    let mut units = 0;
    for character in normalized.trim().chars() {
        let next = character.len_utf16();
        if units + next > max_utf16_units {
            break;
        }
        units += next;
        result.push(character);
    }
    if result.is_empty() {
        fallback.to_owned()
    } else {
        result
    }
}

fn redact_log_message(message: &str) -> String {
    let bearer = BEARER.replace_all(message, "Bearer [redacted]");
    let database = DATABASE_URL.replace_all(&bearer, "${1}[redacted]@");
    let query = QUERY_SECRET.replace_all(&database, "${1}[redacted]");
    FIELD_SECRET
        .replace_all(&query, "${1}[redacted]")
        .into_owned()
}

fn format_chat_audit_line(room_key: &str, player_name: &str, message: &str) -> String {
    let player_name = sanitize_audit_text(player_name, 256, "Unknown player");
    let message = sanitize_audit_text(message, 3_700, "[empty]");
    redact_log_message(&format!("[chat] [{room_key}] {player_name}: {message}"))
}

pub(crate) fn resolve_chat_audit_line(
    room_key: &str,
    players: &HashMap<u32, String>,
    sender_uid: u32,
    message: &str,
    local_uid: u32,
) -> Option<String> {
    if sender_uid == 0 || sender_uid == local_uid {
        return None;
    }
    let name = players
        .get(&sender_uid)
        .cloned()
        .unwrap_or_else(|| format!("Unknown player {sender_uid}"));
    Some(format_chat_audit_line(room_key, &name, message))
}

pub(crate) fn log_chat_audit_line(room_key: &str, profile: &str, line: &str) {
    tracing::info!(room.key = room_key, room.profile = profile, "{line}");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Write,
        sync::{Arc, Mutex},
    };

    struct TestWriter(Arc<Mutex<Vec<u8>>>);

    impl Write for TestWriter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(bytes);
            Ok(bytes.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn formats_bun_chat_audit_lines() {
        assert_eq!(
            format_chat_audit_line("totw", "[TAG] Player", "hello"),
            "[chat] [totw] [TAG] Player: hello"
        );
        assert_eq!(
            format_chat_audit_line("totm", "\u{1b}[31mPlayer\nName", "line 1\r\nline 2"),
            "[chat] [totm] Player Name: line 1 line 2"
        );
        assert_eq!(
            format_chat_audit_line("totw", "", ""),
            "[chat] [totw] Unknown player: [empty]"
        );
        assert!(format_chat_audit_line("totw", "Player", &"x".repeat(5_000)).len() < 4_096);
        assert!(format_chat_audit_line("totw", "Player", &"😀".repeat(5_000)).len() < 8_192);
    }

    #[test]
    fn suppresses_system_and_local_echo_and_uses_roster_name() {
        let players = HashMap::from([(42, "[TAG] Player".to_owned())]);
        assert_eq!(
            resolve_chat_audit_line("totw", &players, 42, "hello", 7).as_deref(),
            Some("[chat] [totw] [TAG] Player: hello")
        );
        assert_eq!(
            resolve_chat_audit_line("totw", &players, 99, "hello", 7).as_deref(),
            Some("[chat] [totw] Unknown player 99: hello")
        );
        assert!(resolve_chat_audit_line("totw", &players, 0, "system", 7).is_none());
        assert!(resolve_chat_audit_line("totw", &players, 7, "local", 7).is_none());
    }

    #[test]
    fn redacts_tokens_and_urls_before_export() {
        let message =
            "Bearer abc token=xyz https://host/?access_token=secret postgresql://user:pass@db";
        let line = format_chat_audit_line("totw", "Player", message);
        assert_eq!(
            line,
            "[chat] [totw] Player: Bearer [redacted] token=[redacted] https://host/?access_token=[redacted] postgresql://[redacted]@db"
        );
        assert!(!line.contains("abc"));
        assert!(!line.contains("xyz"));
        assert!(!line.contains("pass"));
    }

    #[test]
    fn emits_info_event_to_structured_console_layer() -> anyhow::Result<()> {
        let output = Arc::new(Mutex::new(Vec::new()));
        let sink = output.clone();
        let subscriber = tracing_subscriber::fmt()
            .json()
            .with_writer(move || TestWriter(sink.clone()))
            .finish();
        tracing::subscriber::with_default(subscriber, || {
            log_chat_audit_line(
                "totw",
                "track-tournament.weekly",
                "[chat] [totw] Player: hello",
            );
        });
        let output = output.lock().unwrap();
        let event: serde_json::Value = serde_json::from_slice(&output)?;
        assert_eq!(event["level"], "INFO");
        assert_eq!(event["target"], "zc_lobby_host::chat::audit");
        assert_eq!(event["fields"]["message"], "[chat] [totw] Player: hello");
        assert_eq!(event["fields"]["room.key"], "totw");
        assert_eq!(event["fields"]["room.profile"], "track-tournament.weekly");
        Ok(())
    }
}
