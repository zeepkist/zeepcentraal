use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
    time::Instant,
};

use sha2::{Digest, Sha256};
use zc_core::zeepnet::{
    BitReader, CHAT_MESSAGE, LidgrenError,
    lidgren::{ReliableWrite, ReliableWriteObserver},
    sanitize_lidgren_disconnect_reason,
};

const PACKET_LIMIT: usize = 32;
const RAW_LIMIT: usize = 64 * 1024;

pub(super) struct History {
    started: Instant,
    connection: uuid::Uuid,
    mtu: usize,
    raw_enabled: bool,
    packets: Mutex<VecDeque<Packet>>,
    local_reason: Mutex<Option<String>>,
}

#[derive(Debug)]
struct Packet {
    marker: Arc<()>,
    queued_at: jiff::Timestamp,
    elapsed_ms: u128,
    id: Option<u16>,
    bytes: usize,
    sha256: String,
    fragmented: bool,
    chat: Option<Chat>,
    raw: Option<Vec<u8>>,
    raw_status: &'static str,
    outcome: &'static str,
    first_write: Option<ReliableWrite>,
    last_chunk: Option<ReliableWrite>,
    retransmits: usize,
}

struct Chat {
    command: Option<&'static str>,
    sender: u32,
    bytes: usize,
    prefix_bytes: usize,
    badges: i32,
}

impl std::fmt::Debug for Chat {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Chat")
            .field("command", &self.command)
            .field("sender", &self.sender)
            .field("bytes", &self.bytes)
            .field("prefix_bytes", &self.prefix_bytes)
            .field("badges", &self.badges)
            .finish()
    }
}

impl History {
    pub(super) fn new(mtu: usize) -> Self {
        Self {
            started: Instant::now(),
            connection: uuid::Uuid::new_v4(),
            mtu,
            raw_enabled: std::env::var("ZC_LOBBY_HOST_RAW_CHAT").as_deref() == Ok("1"),
            local_reason: Mutex::new(None),
            packets: Mutex::new(VecDeque::with_capacity(PACKET_LIMIT)),
        }
    }

    pub(super) fn record(self: &Arc<Self>, bytes: &[u8]) -> Ticket {
        let mut reader = BitReader::new(bytes);
        let id = reader.read_u16().ok();
        let chat = (id == Some(CHAT_MESSAGE))
            .then(|| read_chat(reader))
            .flatten();
        let raw_allowed = self.raw_enabled
            && chat.as_ref().is_some_and(|chat| {
                matches!(
                    chat.command,
                    Some("/servermessage" | "/settime" | "/joinmessage")
                )
            });
        let raw = (raw_allowed && bytes.len() <= RAW_LIMIT).then(|| bytes.to_vec());
        let marker = Arc::new(());
        let sha256 = hex::encode(Sha256::digest(bytes));
        let mut packets = self.packets.lock().unwrap();
        if packets.len() == PACKET_LIMIT {
            packets.pop_front();
        }
        packets.push_back(Packet {
            queued_at: jiff::Timestamp::now(),
            elapsed_ms: self.started.elapsed().as_millis(),
            id,
            bytes: bytes.len(),
            sha256,
            fragmented: bytes.len() > self.mtu - 5,
            chat,
            raw_status: match (raw_allowed, raw.is_some()) {
                (true, true) => "retained",
                (true, false) => "oversized",
                _ => "omitted",
            },
            raw,
            outcome: "submitted_to_transport",
            first_write: None,
            last_chunk: None,
            retransmits: 0,
            marker: marker.clone(),
        });
        let mut retained: usize = packets
            .iter()
            .filter_map(|packet| packet.raw.as_ref())
            .map(Vec::len)
            .sum();
        for packet in &mut *packets {
            if retained <= RAW_LIMIT {
                break;
            }
            if let Some(raw) = packet.raw.take() {
                retained -= raw.len();
                packet.raw_status = "evicted";
            }
        }
        Ticket {
            history: self.clone(),
            marker,
        }
    }

    pub(super) fn local_reason(&self, reason: &str) {
        *self.local_reason.lock().unwrap() = Some(reason.to_owned());
    }

    pub(super) fn log_termination(
        &self,
        lobby: &str,
        profile: &str,
        result: &anyhow::Result<()>,
        dump: bool,
        retry: Option<std::time::Duration>,
    ) {
        let lidgren = result
            .as_ref()
            .err()
            .and_then(|error| error.downcast_ref::<LidgrenError>());
        let remote = match lidgren {
            Some(LidgrenError::RemoteDisconnect { reason, .. }) => {
                Some(sanitize_lidgren_disconnect_reason(reason))
            }
            _ => None,
        };
        let chain = result
            .as_ref()
            .err()
            .map(|error| sanitize_lidgren_disconnect_reason(&format!("{error:#}")));
        let category = match lidgren {
            Some(LidgrenError::RemoteDisconnect { category, .. }) => Some(*category),
            _ => None,
        };
        let local = self.local_reason.lock().unwrap();
        let local_failure = result
            .as_ref()
            .err()
            .and_then(|error| error.downcast_ref::<crate::runtime::ConnectionFailure>());
        let classification = match (lidgren, local_failure, local.as_deref()) {
            (Some(LidgrenError::RemoteDisconnect { .. }), _, _) => "remote_disconnect",
            (Some(LidgrenError::ReliableSendTimeout), _, _) => "reliable_retry_exhausted",
            (Some(LidgrenError::MalformedMessage), _, _) => "malformed_transport",
            (Some(LidgrenError::ConnectionTimeout | LidgrenError::HandshakeTimeout), _, _)
            | (_, Some(crate::runtime::ConnectionFailure::InitialStateTimeout), _) => {
                "local_timeout"
            }
            (Some(LidgrenError::Transport(_)), _, _) => "socket_io",
            (Some(_), _, _) => "transport_failure",
            (_, Some(crate::runtime::ConnectionFailure::HostAuthorityLost), _) => {
                "host_authority_lost"
            }
            (_, _, _) if result.is_err() => "session_failure",
            (_, _, Some("Managed room disabled or stopped")) => "shutdown",
            (_, _, Some("ZSL practice closed for tournament")) => "scheduled_transition",
            _ => "local_close",
        };
        tracing::info!(
            connection = %self.connection,
            lobby,
            profile,
            ?category,
            local_reason = ?*local,
            retry_ms = ?retry.map(|delay| delay.as_millis()),
            duration_ms = self.started.elapsed().as_millis(),
            origin = if remote.is_some() { "remote" } else { "local" },
            classification,
            ?remote,
            ?chain,
            "Game connection terminated"
        );
        if dump && result.is_err() {
            for packet in &*self.packets.lock().unwrap() {
                tracing::info!(connection = %self.connection, utc = %packet.queued_at, elapsed_ms = packet.elapsed_ms, packet_id = ?packet.id, packet_type = packet_type(packet.id), payload_bytes = packet.bytes, sha256 = packet.sha256, fragmented = packet.fragmented, chat = ?packet.chat, outcome = packet.outcome, first_write_elapsed_ms = ?packet.first_write.map(|write| (write.at - self.started).as_millis()), first_write = ?packet.first_write, last_chunk = ?packet.last_chunk, retransmits = packet.retransmits, raw_status = packet.raw_status, raw_hex = ?packet.raw.as_ref().map(hex::encode), "Recent outbound game packet");
            }
        }
    }
}

fn packet_type(id: Option<u16>) -> &'static str {
    match id {
        Some(CHAT_MESSAGE) => "CHAT_MESSAGE",
        Some(zc_core::zeepnet::CUSTOM_CHAT_MESSAGE) => "CUSTOM_CHAT_MESSAGE",
        Some(zc_core::zeepnet::CUSTOM_LEADERBOARD) => "CUSTOM_LEADERBOARD",
        _ => "other",
    }
}

fn read_chat(mut reader: BitReader<'_>) -> Option<Chat> {
    let sender = reader.read_u32().ok()?;
    let before = reader.remaining_bits();
    let message = reader.read_string(4096).ok()?;
    let bytes = message.len();
    let prefix_bytes = (before - reader.remaining_bits()) / 8 - bytes;
    let badges = reader.read_i32().ok()?;
    let command = match message.split_ascii_whitespace().next() {
        Some("/servermessage") => Some("/servermessage"),
        Some("/settime") => Some("/settime"),
        Some("/joinmessage") => Some("/joinmessage"),
        _ => None,
    };
    Some(Chat {
        command,
        sender,
        bytes,
        prefix_bytes,
        badges,
    })
}

pub(super) struct Ticket {
    history: Arc<History>,
    marker: Arc<()>,
}

impl Ticket {
    pub(super) fn observer(&self) -> ReliableWriteObserver {
        let history = Arc::downgrade(&self.history);
        let marker = self.marker.clone();
        Arc::new(move |write| {
            if let Some(history) = history.upgrade()
                && let Some(packet) = history
                    .packets
                    .lock()
                    .unwrap()
                    .iter_mut()
                    .find(|packet| Arc::ptr_eq(&packet.marker, &marker))
            {
                packet.outcome = "written";
                packet.first_write.get_or_insert(write);
                if write.attempt == 1 {
                    packet.last_chunk = Some(write);
                } else {
                    packet.retransmits += 1;
                }
            }
        })
    }

    pub(super) fn complete(&self, acknowledged: bool) {
        if let Some(packet) = self
            .history
            .packets
            .lock()
            .unwrap()
            .iter_mut()
            .find(|packet| Arc::ptr_eq(&packet.marker, &self.marker))
        {
            packet.outcome = if acknowledged {
                "acknowledged"
            } else {
                "failed"
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zc_core::zeepnet::chat_message_packet;

    #[test]
    fn history_bounds_exact_raw_data_and_excludes_arbitrary_chat() -> anyhow::Result<()> {
        let mut history = History::new(1200);
        history.raw_enabled = true;
        let history = Arc::new(history);
        let private = chat_message_packet("private player message")?;
        history.record(&private);
        assert!(history.packets.lock().unwrap()[0].raw.is_none());

        let overlay = chat_message_packet(&format!("/servermessage {}", "x".repeat(4000)))?;
        for _ in 0..40 {
            history.record(&overlay);
        }
        let packets = history.packets.lock().unwrap();
        assert_eq!(packets.len(), PACKET_LIMIT);
        assert!(
            packets
                .iter()
                .filter_map(|packet| packet.raw.as_ref())
                .map(Vec::len)
                .sum::<usize>()
                <= RAW_LIMIT
        );
        assert_eq!(packets.front().unwrap().raw_status, "evicted");
        assert_eq!(
            packets.back().unwrap().raw.as_deref(),
            Some(overlay.as_slice())
        );
        assert!(packets.back().unwrap().fragmented);
        Ok(())
    }
}
