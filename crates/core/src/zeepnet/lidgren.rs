//! Bounded Lidgren UDP client used by managed Zeepkist lobby hosts.
use std::{
    collections::{HashMap, VecDeque},
    net::SocketAddr,
    sync::{Arc, LazyLock},
    time::{Duration, Instant},
};

use anyhow::{Context, Result, ensure};
use rand::random;
use regex::Regex;
use thiserror::Error;
use tokio::{
    net::UdpSocket,
    sync::{Mutex, mpsc, oneshot, watch},
    time::{MissedTickBehavior, interval, interval_at, timeout},
};

use crate::binary::{BitReader, BitWriter};

const PING: u8 = 129;
const PONG: u8 = 130;
const CONNECT: u8 = 131;
const CONNECT_RESPONSE: u8 = 132;
const CONNECTION_ESTABLISHED: u8 = 133;
const ACKNOWLEDGE: u8 = 134;
const DISCONNECT: u8 = 135;
const RELIABLE_ORDERED: u8 = 67;

const MAX_DATAGRAM_BYTES: usize = 2 * 1024 * 1024;
const MAX_FRAGMENT_GROUPS: usize = 32;
const MAX_REASSEMBLED_BYTES: usize = 2 * 1024 * 1024;
const MAX_FRAGMENT_BYTES: usize = 8 * 1024 * 1024;
const FRAGMENT_TTL: Duration = Duration::from_secs(30);
const MAX_OUTGOING_BYTES: usize = 64 * 1024 * 1024;
const MAX_OUTGOING_TRANSFERS: usize = 128;
const SEQUENCE_MODULUS: u16 = 1024;
const RECEIVE_WINDOW: i16 = 64;
const SEND_WINDOW: usize = 64;
const DEFAULT_MTU: usize = 1200;
const RESEND_DELAY: Duration = Duration::from_millis(500);
const MAX_SEND_ATTEMPTS: u8 = 20;
const DISCONNECT_FLUSH_TIMEOUT: Duration = Duration::from_millis(500);
const MAX_DISCONNECT_REASON_BYTES: usize = 512;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LidgrenDisconnectCategory {
    Afk,
    CredentialExpired,
    Kicked,
    Remote,
    Timeout,
}

#[derive(Clone, Debug, Error, Eq, PartialEq)]
pub enum LidgrenError {
    #[error("Lidgren client is not connected")]
    NotConnected,
    #[error("Lidgren client closed")]
    Closed,
    #[error("Master server handshake timed out")]
    HandshakeTimeout,
    #[error("Master server connection timed out")]
    ConnectionTimeout,
    #[error("Reliable Lidgren send timed out")]
    ReliableSendTimeout,
    #[error("Malformed Lidgren message")]
    MalformedMessage,
    #[error("Remote server application identifier mismatch")]
    ApplicationIdentifierMismatch,
    #[error("Lidgren payload exceeds outgoing limit")]
    OutgoingLimit,
    #[error("Invalid reliable sequence channel")]
    InvalidSequenceChannel,
    #[error("UDP transport error: {0}")]
    Transport(String),
    #[error("Remote server disconnected{suffix}", suffix = if reason.is_empty() { String::new() } else { format!(": {reason}") })]
    RemoteDisconnect {
        reason: String,
        category: LidgrenDisconnectCategory,
    },
}

#[derive(Clone, Debug)]
pub struct LidgrenClientOptions {
    pub remote: SocketAddr,
    pub application_identifier: String,
    pub hail: Vec<u8>,
    pub mtu: usize,
}

impl LidgrenClientOptions {
    pub fn game_server(remote: SocketAddr, hail: Vec<u8>) -> Self {
        Self {
            remote,
            application_identifier: "GameServer".into(),
            hail,
            mtu: DEFAULT_MTU,
        }
    }
}

pub struct LidgrenClient {
    commands: mpsc::Sender<Command>,
    payloads: Mutex<mpsc::Receiver<Vec<u8>>>,
    connected: watch::Receiver<Option<std::result::Result<Vec<u8>, LidgrenError>>>,
    closed: watch::Receiver<Option<std::result::Result<(), LidgrenError>>>,
}

impl LidgrenClient {
    pub async fn start(options: LidgrenClientOptions) -> Result<Self> {
        ensure!(options.mtu >= 512, "Lidgren MTU must be at least 512 bytes");
        ensure!(
            options.application_identifier.len() <= 64,
            "Lidgren application identifier exceeds 64 bytes"
        );
        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .context("bind Lidgren UDP socket")?;
        socket
            .connect(options.remote)
            .await
            .context("connect Lidgren UDP socket")?;
        let (command_tx, command_rx) = mpsc::channel(128);
        let (payload_tx, payload_rx) = mpsc::channel(128);
        let (connected_tx, connected_rx) = watch::channel(None);
        let (closed_tx, closed_rx) = watch::channel(None);
        tokio::spawn(run_actor(
            socket,
            options,
            command_rx,
            payload_tx,
            connected_tx,
            closed_tx,
        ));
        Ok(Self {
            commands: command_tx,
            payloads: Mutex::new(payload_rx),
            connected: connected_rx,
            closed: closed_rx,
        })
    }

    pub async fn connect(&self) -> std::result::Result<Vec<u8>, LidgrenError> {
        let mut connected = self.connected.clone();
        loop {
            if let Some(result) = connected.borrow().clone() {
                return result;
            }
            connected
                .changed()
                .await
                .map_err(|_| LidgrenError::Closed)?;
        }
    }

    pub async fn recv(&self) -> Option<Vec<u8>> {
        self.payloads.lock().await.recv().await
    }

    pub async fn send_reliable_ordered(
        &self,
        payload: Vec<u8>,
        sequence_channel: u8,
    ) -> std::result::Result<(), LidgrenError> {
        let (complete, response) = oneshot::channel();
        self.commands
            .send(Command::Send {
                payload,
                sequence_channel,
                complete,
            })
            .await
            .map_err(|_| LidgrenError::Closed)?;
        response.await.unwrap_or(Err(LidgrenError::Closed))
    }

    pub async fn close(&self, reason: impl Into<String>) -> std::result::Result<(), LidgrenError> {
        if self.closed.borrow().is_some() {
            return self.wait_for_close().await;
        }
        let (complete, response) = oneshot::channel();
        self.commands
            .send(Command::Close {
                reason: reason.into(),
                complete,
            })
            .await
            .map_err(|_| LidgrenError::Closed)?;
        response.await.unwrap_or(Err(LidgrenError::Closed))
    }

    pub async fn wait_for_close(&self) -> std::result::Result<(), LidgrenError> {
        let mut closed = self.closed.clone();
        loop {
            if let Some(result) = closed.borrow().clone() {
                return result;
            }
            closed.changed().await.map_err(|_| LidgrenError::Closed)?;
        }
    }
}

enum Command {
    Send {
        payload: Vec<u8>,
        sequence_channel: u8,
        complete: oneshot::Sender<std::result::Result<(), LidgrenError>>,
    },
    Close {
        reason: String,
        complete: oneshot::Sender<std::result::Result<(), LidgrenError>>,
    },
}

struct IncomingMessage {
    message_type: u8,
    sequence: u16,
    fragmented: bool,
    payload: Vec<u8>,
}

struct FragmentGroup {
    total_bytes: usize,
    chunk_byte_size: usize,
    chunks: HashMap<u32, Vec<u8>>,
    created_at: Instant,
}

struct Transfer {
    payload: Arc<[u8]>,
    chunk_byte_size: usize,
    chunk_count: usize,
    group_id: u32,
    message_type: u8,
    next_chunk: usize,
    remaining: usize,
    complete: oneshot::Sender<std::result::Result<(), LidgrenError>>,
}

struct PendingReliable {
    attempts: u8,
    fragmented: bool,
    last_sent_at: Instant,
    payload: Vec<u8>,
    payload_bits: usize,
    sequence: u16,
    transfer_id: u64,
    message_type: u8,
}

struct State {
    options: LidgrenClientOptions,
    connected: bool,
    handshake_attempts: u8,
    last_received_at: Instant,
    last_ping_at: Instant,
    ping_number: u8,
    expected_sequences: HashMap<u8, u16>,
    withheld: HashMap<u8, HashMap<u16, IncomingMessage>>,
    fragments: HashMap<(u8, u32), FragmentGroup>,
    fragment_bytes: usize,
    send_sequences: HashMap<u8, u16>,
    fragment_group: u32,
    transfers: HashMap<u64, Transfer>,
    transfer_queue: VecDeque<u64>,
    outgoing_bytes: usize,
    next_transfer_id: u64,
    pending_reliable: HashMap<(u8, u16), PendingReliable>,
}

impl State {
    fn new(options: LidgrenClientOptions) -> Self {
        let now = Instant::now();
        Self {
            options,
            connected: false,
            handshake_attempts: 0,
            last_received_at: now,
            last_ping_at: now - Duration::from_secs(4),
            ping_number: 0,
            expected_sequences: HashMap::new(),
            withheld: HashMap::new(),
            fragments: HashMap::new(),
            fragment_bytes: 0,
            send_sequences: HashMap::new(),
            fragment_group: 1,
            transfers: HashMap::new(),
            transfer_queue: VecDeque::new(),
            outgoing_bytes: 0,
            next_transfer_id: 1,
            pending_reliable: HashMap::new(),
        }
    }

    fn reject_transfers(&mut self, error: LidgrenError) {
        for (_, transfer) in self.transfers.drain() {
            let _ = transfer.complete.send(Err(error.clone()));
        }
        self.transfer_queue.clear();
        self.pending_reliable.clear();
        self.outgoing_bytes = 0;
    }
}

async fn run_actor(
    socket: UdpSocket,
    options: LidgrenClientOptions,
    mut commands: mpsc::Receiver<Command>,
    payloads: mpsc::Sender<Vec<u8>>,
    connected: watch::Sender<Option<std::result::Result<Vec<u8>, LidgrenError>>>,
    closed: watch::Sender<Option<std::result::Result<(), LidgrenError>>>,
) {
    let mut state = State::new(options);
    let mut receive_buffer = vec![0; MAX_DATAGRAM_BYTES + 1];
    let mut handshake = interval_at(Instant::now().into(), Duration::from_secs(3));
    handshake.set_missed_tick_behavior(MissedTickBehavior::Delay);
    let mut sender = interval(Duration::from_millis(50));
    sender.set_missed_tick_behavior(MissedTickBehavior::Delay);
    let mut maintenance = interval(Duration::from_secs(1));
    maintenance.set_missed_tick_behavior(MissedTickBehavior::Delay);

    let outcome = loop {
        tokio::select! {
            receive = socket.recv(&mut receive_buffer) => {
                match receive {
                    Ok(length) if length <= MAX_DATAGRAM_BYTES => {
                        state.last_received_at = Instant::now();
                        if let Err(error) = receive_datagram(
                            &socket,
                            &mut state,
                            &receive_buffer[..length],
                            &payloads,
                            &connected,
                        ).await {
                            break Err(error);
                        }
                    }
                    Ok(_) => continue,
                    Err(error) => break Err(LidgrenError::Transport(error.kind().to_string())),
                }
            }
            Some(command) = commands.recv() => match command {
                Command::Send { payload, sequence_channel, complete } => {
                    if let Err((error, complete)) = enqueue_transfer(&mut state, payload, sequence_channel, complete) {
                        let _ = complete.send(Err(error));
                    } else if let Err(error) = flush_reliable_queue(&socket, &mut state).await {
                        break Err(error);
                    }
                }
                Command::Close { reason, complete } => {
                    if state.connected {
                        let mut writer = BitWriter::new();
                        if writer.string(&reason).is_ok() {
                            let packet = encode_message(DISCONNECT, writer.as_bytes(), writer.bit_length(), 0, false);
                            let _ = timeout(DISCONNECT_FLUSH_TIMEOUT, socket.send(&packet)).await;
                        }
                    }
                    let _ = complete.send(Ok(()));
                    break Ok(());
                }
            },
            _ = handshake.tick(), if !state.connected => {
                if state.handshake_attempts >= 5 {
                    break Err(LidgrenError::HandshakeTimeout);
                }
                state.handshake_attempts += 1;
                if let Err(error) = send_connect(&socket, &state).await {
                    break Err(error);
                }
            }
            _ = sender.tick(), if state.connected => {
                if let Err(error) = maintain_reliable_sends(&socket, &mut state).await {
                    break Err(error);
                }
            }
            _ = maintenance.tick(), if state.connected => {
                let now = Instant::now();
                expire_fragments(&mut state, now);
                if now.duration_since(state.last_received_at) > Duration::from_secs(25) {
                    break Err(LidgrenError::ConnectionTimeout);
                }
                if now.duration_since(state.last_ping_at) >= Duration::from_secs(4) {
                    state.last_ping_at = now;
                    let ping = [state.ping_number];
                    state.ping_number = state.ping_number.wrapping_add(1);
                    if let Err(error) = send_message(&socket, PING, &ping, 8, 0, false).await {
                        break Err(error);
                    }
                }
            }
            else => break Err(LidgrenError::Closed),
        }
    };

    let terminal_error = outcome
        .as_ref()
        .err()
        .cloned()
        .unwrap_or(LidgrenError::Closed);
    state.reject_transfers(terminal_error.clone());
    if !state.connected {
        let _ = connected.send(Some(Err(terminal_error)));
    }
    let _ = closed.send(Some(outcome));
}

async fn send_connect(socket: &UdpSocket, state: &State) -> std::result::Result<(), LidgrenError> {
    let mut payload = BitWriter::new();
    payload
        .string(&state.options.application_identifier)
        .map_err(|_| LidgrenError::MalformedMessage)?;
    payload.int64(random());
    payload.float32(now_seconds());
    payload.bytes(&state.options.hail);
    send_message(
        socket,
        CONNECT,
        payload.as_bytes(),
        payload.bit_length(),
        0,
        false,
    )
    .await
}

async fn receive_datagram(
    socket: &UdpSocket,
    state: &mut State,
    data: &[u8],
    payloads: &mpsc::Sender<Vec<u8>>,
    connected: &watch::Sender<Option<std::result::Result<Vec<u8>, LidgrenError>>>,
) -> std::result::Result<(), LidgrenError> {
    let mut offset = 0;
    while offset < data.len() {
        if data.len() - offset < 5 {
            return Err(LidgrenError::MalformedMessage);
        }
        let message_type = data[offset];
        let sequence =
            ((u16::from(data[offset + 1]) >> 1) | (u16::from(data[offset + 2]) << 7)) & 1023;
        let fragmented = data[offset + 1] & 1 == 1;
        let payload_bits = usize::from(data[offset + 3]) | (usize::from(data[offset + 4]) << 8);
        let payload_bytes = payload_bits.div_ceil(8);
        offset += 5;
        if payload_bytes > data.len() - offset {
            return Err(LidgrenError::MalformedMessage);
        }
        let message = IncomingMessage {
            message_type,
            sequence,
            fragmented,
            payload: data[offset..offset + payload_bytes].to_vec(),
        };
        offset += payload_bytes;
        receive_message(socket, state, message, payloads, connected).await?;
    }
    Ok(())
}

async fn receive_message(
    socket: &UdpSocket,
    state: &mut State,
    message: IncomingMessage,
    payloads: &mpsc::Sender<Vec<u8>>,
    connected: &watch::Sender<Option<std::result::Result<Vec<u8>, LidgrenError>>>,
) -> std::result::Result<(), LidgrenError> {
    match message.message_type {
        CONNECT_RESPONSE => {
            if state.connected {
                let mut established = BitWriter::new();
                established.float32(now_seconds());
                return send_message(
                    socket,
                    CONNECTION_ESTABLISHED,
                    established.as_bytes(),
                    established.bit_length(),
                    0,
                    false,
                )
                .await;
            }
            let mut reader = BitReader::new(&message.payload);
            let identifier = reader
                .string(64)
                .map_err(|_| LidgrenError::MalformedMessage)?;
            if identifier != state.options.application_identifier {
                return Err(LidgrenError::ApplicationIdentifierMismatch);
            }
            reader.int64().map_err(|_| LidgrenError::MalformedMessage)?;
            reader
                .float32()
                .map_err(|_| LidgrenError::MalformedMessage)?;
            let hail = reader
                .bytes(reader.remaining_bits() / 8)
                .map_err(|_| LidgrenError::MalformedMessage)?;
            let mut established = BitWriter::new();
            established.float32(now_seconds());
            send_message(
                socket,
                CONNECTION_ESTABLISHED,
                established.as_bytes(),
                established.bit_length(),
                0,
                false,
            )
            .await?;
            if !state.connected {
                state.connected = true;
                let _ = connected.send(Some(Ok(hail)));
            }
        }
        PING => {
            let Some(&number) = message.payload.first() else {
                return Ok(());
            };
            let mut pong = BitWriter::new();
            pong.byte(number);
            pong.float32(now_seconds());
            send_message(socket, PONG, pong.as_bytes(), pong.bit_length(), 0, false).await?;
        }
        DISCONNECT => {
            let reason = if message.payload.is_empty() {
                String::new()
            } else {
                BitReader::new(&message.payload)
                    .string(MAX_DISCONNECT_REASON_BYTES)
                    .map_err(|_| LidgrenError::MalformedMessage)?
            };
            let reason = sanitize_lidgren_disconnect_reason(&reason);
            return Err(LidgrenError::RemoteDisconnect {
                category: categorize_lidgren_disconnect_reason(&reason),
                reason,
            });
        }
        ACKNOWLEDGE => {
            receive_acknowledgements(state, &message.payload);
            flush_reliable_queue(socket, state).await?;
        }
        RELIABLE_ORDERED..=98 => receive_reliable_ordered(socket, state, message, payloads).await?,
        _ => {}
    }
    Ok(())
}

async fn receive_reliable_ordered(
    socket: &UdpSocket,
    state: &mut State,
    message: IncomingMessage,
    payloads: &mpsc::Sender<Vec<u8>>,
) -> std::result::Result<(), LidgrenError> {
    let ack = [
        message.message_type,
        message.sequence as u8,
        (message.sequence >> 8) as u8,
    ];
    send_message(socket, ACKNOWLEDGE, &ack, 24, 0, false).await?;
    let expected = *state
        .expected_sequences
        .get(&message.message_type)
        .unwrap_or(&0);
    let relative = relative_sequence(message.sequence, expected);
    if !(0..=RECEIVE_WINDOW).contains(&relative) {
        return Ok(());
    }
    if relative > 0 {
        state
            .withheld
            .entry(message.message_type)
            .or_default()
            .insert(message.sequence, message);
        return Ok(());
    }
    let message_type = message.message_type;
    release(state, message, payloads)?;
    let mut next = (expected + 1) % SEQUENCE_MODULUS;
    loop {
        let withheld = state
            .withheld
            .get_mut(&message_type)
            .and_then(|messages| messages.remove(&next));
        let Some(withheld) = withheld else { break };
        release(state, withheld, payloads)?;
        next = (next + 1) % SEQUENCE_MODULUS;
    }
    state.expected_sequences.insert(message_type, next);
    if state
        .withheld
        .get(&message_type)
        .is_some_and(HashMap::is_empty)
    {
        state.withheld.remove(&message_type);
    }
    Ok(())
}

fn release(
    state: &mut State,
    message: IncomingMessage,
    payloads: &mpsc::Sender<Vec<u8>>,
) -> std::result::Result<(), LidgrenError> {
    if !message.fragmented {
        return payloads
            .try_send(message.payload)
            .map_err(|_| LidgrenError::MalformedMessage);
    }
    let mut reader = BitReader::new(&message.payload);
    let group_id = reader
        .variable_uint32()
        .map_err(|_| LidgrenError::MalformedMessage)?;
    let total_bits = reader
        .variable_uint32()
        .map_err(|_| LidgrenError::MalformedMessage)? as usize;
    let chunk_byte_size = reader
        .variable_uint32()
        .map_err(|_| LidgrenError::MalformedMessage)? as usize;
    let chunk_number = reader
        .variable_uint32()
        .map_err(|_| LidgrenError::MalformedMessage)?;
    let total_bytes = total_bits.div_ceil(8);
    let chunk_count = total_bytes.div_ceil(chunk_byte_size.max(1));
    if total_bytes > MAX_REASSEMBLED_BYTES
        || chunk_byte_size == 0
        || chunk_byte_size > MAX_REASSEMBLED_BYTES
        || chunk_number as usize >= chunk_count
    {
        return Err(LidgrenError::MalformedMessage);
    }
    let key = (message.message_type, group_id);
    if !state.fragments.contains_key(&key) && state.fragments.len() >= MAX_FRAGMENT_GROUPS {
        return Err(LidgrenError::MalformedMessage);
    }
    let expected_chunk_bytes =
        chunk_byte_size.min(total_bytes - chunk_number as usize * chunk_byte_size);
    let chunk = reader
        .bytes(expected_chunk_bytes)
        .map_err(|_| LidgrenError::MalformedMessage)?;
    let group = state.fragments.entry(key).or_insert_with(|| FragmentGroup {
        total_bytes,
        chunk_byte_size,
        chunks: HashMap::new(),
        created_at: Instant::now(),
    });
    if group.total_bytes != total_bytes || group.chunk_byte_size != chunk_byte_size {
        return Err(LidgrenError::MalformedMessage);
    }
    if let std::collections::hash_map::Entry::Vacant(entry) = group.chunks.entry(chunk_number) {
        if state.fragment_bytes + chunk.len() > MAX_FRAGMENT_BYTES {
            return Err(LidgrenError::MalformedMessage);
        }
        state.fragment_bytes += chunk.len();
        entry.insert(chunk);
    }
    if group.chunks.len() != chunk_count {
        return Ok(());
    }
    let group = state.fragments.remove(&key).expect("fragment group exists");
    let mut reassembled = vec![0; total_bytes];
    for index in 0..chunk_count {
        let chunk = group
            .chunks
            .get(&(index as u32))
            .ok_or(LidgrenError::MalformedMessage)?;
        reassembled[index * chunk_byte_size..index * chunk_byte_size + chunk.len()]
            .copy_from_slice(chunk);
        state.fragment_bytes -= chunk.len();
    }
    payloads
        .try_send(reassembled)
        .map_err(|_| LidgrenError::MalformedMessage)
}

fn expire_fragments(state: &mut State, now: Instant) {
    state.fragments.retain(|_, group| {
        let keep = now.duration_since(group.created_at) < FRAGMENT_TTL;
        if !keep {
            state.fragment_bytes -= group.chunks.values().map(Vec::len).sum::<usize>();
        }
        keep
    });
}

fn enqueue_transfer(
    state: &mut State,
    payload: Vec<u8>,
    sequence_channel: u8,
    complete: oneshot::Sender<std::result::Result<(), LidgrenError>>,
) -> std::result::Result<
    (),
    (
        LidgrenError,
        oneshot::Sender<std::result::Result<(), LidgrenError>>,
    ),
> {
    if !state.connected {
        return Err((LidgrenError::NotConnected, complete));
    }
    if sequence_channel > 31 {
        return Err((LidgrenError::InvalidSequenceChannel, complete));
    }
    if payload.len() > MAX_OUTGOING_BYTES
        || state.outgoing_bytes + payload.len() > MAX_OUTGOING_BYTES
        || state.transfers.len() >= MAX_OUTGOING_TRANSFERS
    {
        return Err((LidgrenError::OutgoingLimit, complete));
    }
    let chunk_byte_size = state.options.mtu - 32;
    let chunk_count = if payload.len() + 5 <= state.options.mtu {
        1
    } else {
        payload.len().div_ceil(chunk_byte_size)
    };
    let group_id = if chunk_count == 1 {
        0
    } else {
        let current = state.fragment_group;
        state.fragment_group = if current >= 0x7fff_ffff {
            1
        } else {
            current + 1
        };
        current
    };
    let transfer_id = state.next_transfer_id;
    state.next_transfer_id = state.next_transfer_id.wrapping_add(1);
    state.outgoing_bytes += payload.len();
    state.transfers.insert(
        transfer_id,
        Transfer {
            payload: payload.into(),
            chunk_byte_size,
            chunk_count,
            group_id,
            message_type: RELIABLE_ORDERED + sequence_channel,
            next_chunk: 0,
            remaining: chunk_count,
            complete,
        },
    );
    state.transfer_queue.push_back(transfer_id);
    Ok(())
}

async fn flush_reliable_queue(
    socket: &UdpSocket,
    state: &mut State,
) -> std::result::Result<(), LidgrenError> {
    while state.pending_reliable.len() < SEND_WINDOW {
        let Some(&transfer_id) = state.transfer_queue.front() else {
            return Ok(());
        };
        let transfer = state
            .transfers
            .get_mut(&transfer_id)
            .expect("queued transfer exists");
        let chunk_number = transfer.next_chunk;
        transfer.next_chunk += 1;
        let chunk_offset = chunk_number * transfer.chunk_byte_size;
        let chunk = &transfer.payload[chunk_offset
            ..transfer
                .payload
                .len()
                .min(chunk_offset + transfer.chunk_byte_size)];
        let (payload, payload_bits) = if transfer.group_id == 0 {
            (chunk.to_vec(), chunk.len() * 8)
        } else {
            let mut writer = BitWriter::new();
            writer.variable_uint32(transfer.group_id);
            writer.variable_uint32((transfer.payload.len() * 8) as u32);
            writer.variable_uint32(transfer.chunk_byte_size as u32);
            writer.variable_uint32(chunk_number as u32);
            writer.bytes(chunk);
            let bits = writer.bit_length();
            (writer.into_bytes(), bits)
        };
        if transfer.next_chunk >= transfer.chunk_count {
            state.transfer_queue.pop_front();
        }
        let sequence = *state
            .send_sequences
            .get(&transfer.message_type)
            .unwrap_or(&0);
        state
            .send_sequences
            .insert(transfer.message_type, (sequence + 1) % SEQUENCE_MODULUS);
        let mut pending = PendingReliable {
            attempts: 0,
            fragmented: transfer.group_id != 0,
            last_sent_at: Instant::now() - RESEND_DELAY,
            payload,
            payload_bits,
            sequence,
            transfer_id,
            message_type: transfer.message_type,
        };
        send_reliable_message(socket, &mut pending).await?;
        state
            .pending_reliable
            .insert((pending.message_type, pending.sequence), pending);
    }
    Ok(())
}

fn receive_acknowledgements(state: &mut State, payload: &[u8]) {
    for ack in payload.as_chunks::<3>().0 {
        let message_type = ack[0];
        let sequence = (u16::from(ack[1]) | (u16::from(ack[2]) << 8)) & 1023;
        let Some(pending) = state.pending_reliable.remove(&(message_type, sequence)) else {
            continue;
        };
        let Some(transfer) = state.transfers.get_mut(&pending.transfer_id) else {
            continue;
        };
        transfer.remaining -= 1;
        if transfer.remaining == 0 {
            let transfer = state
                .transfers
                .remove(&pending.transfer_id)
                .expect("completed transfer exists");
            state.outgoing_bytes -= transfer.payload.len();
            let _ = transfer.complete.send(Ok(()));
        }
    }
}

async fn maintain_reliable_sends(
    socket: &UdpSocket,
    state: &mut State,
) -> std::result::Result<(), LidgrenError> {
    let now = Instant::now();
    for pending in state.pending_reliable.values_mut() {
        if now.duration_since(pending.last_sent_at) < RESEND_DELAY {
            continue;
        }
        if pending.attempts >= MAX_SEND_ATTEMPTS {
            return Err(LidgrenError::ReliableSendTimeout);
        }
        send_reliable_message(socket, pending).await?;
    }
    flush_reliable_queue(socket, state).await
}

async fn send_reliable_message(
    socket: &UdpSocket,
    pending: &mut PendingReliable,
) -> std::result::Result<(), LidgrenError> {
    pending.attempts += 1;
    pending.last_sent_at = Instant::now();
    send_message(
        socket,
        pending.message_type,
        &pending.payload,
        pending.payload_bits,
        pending.sequence,
        pending.fragmented,
    )
    .await
}

async fn send_message(
    socket: &UdpSocket,
    message_type: u8,
    payload: &[u8],
    payload_bits: usize,
    sequence: u16,
    fragmented: bool,
) -> std::result::Result<(), LidgrenError> {
    if payload_bits > u16::MAX as usize {
        return Err(LidgrenError::MalformedMessage);
    }
    let packet = encode_message(message_type, payload, payload_bits, sequence, fragmented);
    socket
        .send(&packet)
        .await
        .map_err(|error| LidgrenError::Transport(error.kind().to_string()))?;
    Ok(())
}

fn encode_message(
    message_type: u8,
    payload: &[u8],
    payload_bits: usize,
    sequence: u16,
    fragmented: bool,
) -> Vec<u8> {
    let mut packet = Vec::with_capacity(5 + payload.len());
    packet.push(message_type);
    packet.push(((sequence << 1) | u16::from(fragmented)) as u8);
    packet.push((sequence >> 7) as u8);
    packet.push(payload_bits as u8);
    packet.push((payload_bits >> 8) as u8);
    packet.extend_from_slice(payload);
    packet
}

fn relative_sequence(sequence: u16, expected: u16) -> i16 {
    ((i32::from(sequence) - i32::from(expected) + 1536) % 1024 - 512) as i16
}

fn now_seconds() -> f32 {
    static START: LazyLock<Instant> = LazyLock::new(Instant::now);
    START.elapsed().as_secs_f32()
}

static TOKEN_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(bearer|token|ticket)(?:\s+|\s*[=:]\s*)\S+").expect("valid token regex")
});
static JWT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b")
        .expect("valid JWT regex")
});
static HEX_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b[A-Fa-f0-9]{32,}\b").expect("valid hex regex"));
static BASE64_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b[A-Za-z0-9_+/-]{48,}={0,2}\b").expect("valid base64 regex"));

pub fn sanitize_lidgren_disconnect_reason(reason: &str) -> String {
    let safe: String = reason
        .chars()
        .map(|character| {
            if character < ' ' || character == '\u{7f}' {
                ' '
            } else {
                character
            }
        })
        .collect();
    let safe = TOKEN_PATTERN.replace_all(&safe, |captures: &regex::Captures<'_>| {
        if captures[0].to_ascii_lowercase().starts_with("bearer ") {
            "bearer [redacted]".to_owned()
        } else {
            format!("{}=[redacted]", captures[1].to_ascii_lowercase())
        }
    });
    let safe = JWT_PATTERN.replace_all(&safe, "[redacted]");
    let safe = HEX_PATTERN.replace_all(&safe, "[redacted]");
    let safe = BASE64_PATTERN.replace_all(&safe, "[redacted]");
    safe.trim().chars().take(200).collect()
}

fn categorize_lidgren_disconnect_reason(reason: &str) -> LidgrenDisconnectCategory {
    let reason = reason.to_ascii_lowercase();
    if reason
        .split(|character: char| !character.is_ascii_alphanumeric())
        .any(|word| word == "afk")
    {
        LidgrenDisconnectCategory::Afk
    } else if ["token", "ticket", "credential", "auth", "expired"]
        .iter()
        .any(|value| reason.contains(value))
    {
        LidgrenDisconnectCategory::CredentialExpired
    } else if ["timeout", "timed out", "inactive"]
        .iter()
        .any(|value| reason.contains(value))
    {
        LidgrenDisconnectCategory::Timeout
    } else if ["kick", "ban", "duplicate", "already online"]
        .iter()
        .any(|value| reason.contains(value))
    {
        LidgrenDisconnectCategory::Kicked
    } else {
        LidgrenDisconnectCategory::Remote
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn server() -> UdpSocket {
        UdpSocket::bind("127.0.0.1:0").await.unwrap()
    }

    fn response(identifier: &str, hail: &[u8]) -> Vec<u8> {
        let mut payload = BitWriter::new();
        payload.string(identifier).unwrap();
        payload.int64(0);
        payload.float32(0.0);
        payload.bytes(hail);
        encode_message(
            CONNECT_RESPONSE,
            payload.as_bytes(),
            payload.bit_length(),
            0,
            false,
        )
    }

    async fn connected_client(server: &UdpSocket, mtu: usize) -> LidgrenClient {
        let client = LidgrenClient::start(LidgrenClientOptions {
            remote: server.local_addr().unwrap(),
            application_identifier: "GameServer".into(),
            hail: vec![1, 2, 3],
            mtu,
        })
        .await
        .unwrap();
        let mut datagram = [0; 2048];
        let (length, remote) = server.recv_from(&mut datagram).await.unwrap();
        assert_eq!(datagram[0], CONNECT);
        let mut reader = BitReader::new(&datagram[5..length]);
        assert_eq!(reader.string(64).unwrap(), "GameServer");
        server
            .send_to(&response("GameServer", &[4, 5, 6]), remote)
            .await
            .unwrap();
        assert_eq!(client.connect().await.unwrap(), [4, 5, 6]);
        client
    }

    #[test]
    fn redacts_and_categorizes_disconnect_reasons() {
        assert_eq!(
            sanitize_lidgren_disconnect_reason(&format!("token={}\nclosed", "a".repeat(64))),
            "token=[redacted] closed"
        );
        assert_eq!(
            sanitize_lidgren_disconnect_reason("Bearer short-secret"),
            "bearer [redacted]"
        );
        assert_eq!(
            categorize_lidgren_disconnect_reason("AFK"),
            LidgrenDisconnectCategory::Afk
        );
        assert_eq!(relative_sequence(1023, 0), -1);
        assert_eq!(relative_sequence(0, 1023), 1);
    }

    #[tokio::test]
    async fn connects_exposes_hail_and_flushes_disconnect() {
        let server = server().await;
        let client = connected_client(&server, DEFAULT_MTU).await;
        let close = client.close("Client shutting down");
        tokio::pin!(close);
        let mut datagram = [0; 2048];
        loop {
            tokio::select! {
                result = &mut close => { result.unwrap(); break; }
                received = server.recv_from(&mut datagram) => {
                    let (length, _) = received.unwrap();
                    if datagram[0] == DISCONNECT {
                        assert_eq!(BitReader::new(&datagram[5..length]).string(512).unwrap(), "Client shutting down");
                    }
                }
            }
        }
        assert_eq!(client.wait_for_close().await, Ok(()));
    }

    #[tokio::test]
    async fn retries_reliable_message_and_settles_on_ack() {
        let server = server().await;
        let client = connected_client(&server, DEFAULT_MTU).await;
        let send = client.send_reliable_ordered(vec![9], 0);
        tokio::pin!(send);
        let mut datagram = [0; 2048];
        let mut attempts = 0;
        loop {
            tokio::select! {
                result = &mut send => { result.unwrap(); break; }
                received = server.recv_from(&mut datagram) => {
                    let (length, remote) = received.unwrap();
                    if datagram[0] != RELIABLE_ORDERED { continue; }
                    attempts += 1;
                    if attempts == 2 {
                        let sequence = ((u16::from(datagram[1]) >> 1) | (u16::from(datagram[2]) << 7)) & 1023;
                        let ack = [RELIABLE_ORDERED, sequence as u8, (sequence >> 8) as u8];
                        let packet = encode_message(ACKNOWLEDGE, &ack, 24, 0, false);
                        server.send_to(&packet, remote).await.unwrap();
                    }
                    let _ = length;
                }
            }
        }
        assert_eq!(attempts, 2);
        client.close("done").await.unwrap();
    }

    #[tokio::test]
    async fn rejects_oversized_incoming_fragment() {
        let server = server().await;
        let client = connected_client(&server, DEFAULT_MTU).await;
        let mut fragment = BitWriter::new();
        fragment.variable_uint32(1);
        fragment.variable_uint32(3 * 1024 * 1024 * 8);
        fragment.variable_uint32(100);
        fragment.variable_uint32(0);
        let packet = encode_message(
            RELIABLE_ORDERED,
            fragment.as_bytes(),
            fragment.bit_length(),
            0,
            true,
        );
        // Use address from a fresh client packet to reach connected UDP socket.
        let ping = client.send_reliable_ordered(vec![1], 0);
        tokio::pin!(ping);
        let mut datagram = [0; 2048];
        let (_, remote) = server.recv_from(&mut datagram).await.unwrap();
        server.send_to(&packet, remote).await.unwrap();
        assert_eq!(
            client.wait_for_close().await,
            Err(LidgrenError::MalformedMessage)
        );
    }
}
