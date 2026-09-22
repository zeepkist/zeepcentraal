//! Chat functionality for Steam client.
//!
//! This module provides friend messaging, typing indicators, and chat history.

use prost::Message;
use steam_enums::EChatEntryType;
use steamid::SteamID;
use tracing::{error, info};

use crate::{error::SteamError, SteamClient};

/// Chat message sent to a friend.
#[derive(Debug, Clone)]
pub struct ChatMessage {
    /// The message content.
    pub message: String,
    /// The chat entry type.
    pub chat_entry_type: EChatEntryType,
    /// Whether the message contains BBCode.
    pub contains_bbcode: bool,
}

impl Default for ChatMessage {
    fn default() -> Self {
        Self { message: String::new(), chat_entry_type: EChatEntryType::ChatMsg, contains_bbcode: true }
    }
}

/// Result of sending a chat message.
#[derive(Debug, Clone)]
pub struct SendMessageResult {
    /// The modified message (after server processing).
    pub modified_message: String,
    /// Server timestamp of the message.
    pub server_timestamp: u32,
    /// Message ordinal.
    pub ordinal: u32,
}

/// A message from chat history.
#[derive(Debug, Clone)]
pub struct HistoryMessage {
    /// The sender's SteamID.
    pub sender: SteamID,
    /// Server timestamp.
    pub timestamp: u32,
    /// Message ordinal.
    pub ordinal: u32,
    /// The message content.
    pub message: String,
    /// Whether this message was unread.
    pub unread: bool,
}

/// Active message session with a friend.
#[derive(Debug, Clone)]
pub struct FriendMessageSession {
    /// Friend's SteamID.
    pub friend: SteamID,
    /// Time of last message.
    pub time_last_message: u32,
    /// Time last viewed.
    pub time_last_view: u32,
    /// Count of unread messages.
    pub unread_count: u32,
}

impl SteamClient {
    /// Send a chat message to a friend.
    ///
    /// # Arguments
    /// * `friend` - The friend's SteamID
    /// * `message` - The message to send
    ///
    /// # Example
    /// ```rust,ignore
    /// client.send_friend_message(friend_id, "Hello!").await?;
    /// ```
    pub async fn send_friend_message(&mut self, friend: SteamID, message: &str) -> Result<SendMessageResult, SteamError> {
        self.send_friend_message_with_options(friend, message, EChatEntryType::ChatMsg, true).await
    }

    /// Send a chat message to a friend without awaiting the server response.
    ///
    /// This returns a receiver that will yield the result once the message
    /// is processed by the event loop.
    pub fn send_friend_message_async(&mut self, friend: SteamID, message: &str) -> Result<tokio::sync::oneshot::Receiver<Result<SendMessageResult, SteamError>>, SteamError> {
        info!("[SteamClient] send_friend_message_async called");
        info!("[SteamClient]   Target friend: {}", friend);
        info!("[SteamClient]   Message length: {}", message.len());
        info!("[SteamClient]   is_logged_in: {}", self.is_logged_in());
        info!("[SteamClient]   steam_id: {:?}", self.steam_id);

        if !self.is_logged_in() {
            error!("[SteamClient] NOT LOGGED IN - returning NotLoggedOn error");
            return Err(SteamError::NotLoggedOn);
        }

        let (tx, rx) = tokio::sync::oneshot::channel();

        let queued = crate::client::steam_client::QueuedMessage {
            friend,
            message: message.to_string(),
            entry_type: EChatEntryType::ChatMsg,
            contains_bbcode: true,
            respond_to: tx,
        };

        match self.chat.tx.send(queued) {
            Ok(_) => {
                info!("[SteamClient] Message queued to chat_queue_tx successfully for {}", friend);
            }
            Err(e) => {
                error!("[SteamClient] Failed to queue message to chat_queue_tx: {:?}", e);
                return Err(SteamError::Other("Failed to queue message".to_string()));
            }
        }

        Ok(rx)
    }

    /// Send a chat message to a friend with custom options.
    ///
    /// # Arguments
    /// * `friend` - The friend's SteamID
    /// * `message` - The message to send
    /// * `entry_type` - The chat entry type
    /// * `contains_bbcode` - Whether the message contains BBCode
    pub async fn send_friend_message_with_options(&mut self, friend: SteamID, message: &str, entry_type: EChatEntryType, contains_bbcode: bool) -> Result<SendMessageResult, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let (tx, rx) = tokio::sync::oneshot::channel();

        let queued = crate::client::steam_client::QueuedMessage { friend, message: message.to_string(), entry_type, contains_bbcode, respond_to: tx };

        self.chat.tx.send(queued).map_err(|_| SteamError::Other("Failed to queue message".to_string()))?;

        rx.await.map_err(|_| SteamError::Other("Response channel closed".to_string()))?
    }

    /// Send a typing indicator to a friend.
    ///
    /// # Arguments
    /// * `friend` - The friend's SteamID
    pub async fn send_friend_typing(&mut self, friend: SteamID) -> Result<(), SteamError> {
        self.send_friend_message_with_options(friend, "", EChatEntryType::Typing, false).await?;
        Ok(())
    }

    /// Get active friend message sessions.
    ///
    /// Returns a list of friends with active (recent) conversations.
    pub async fn get_active_friend_sessions(&mut self) -> Result<Vec<FriendMessageSession>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CFriendMessagesGetActiveMessageSessionsRequest::default();
        let rx = self.send_service_method_with_job("FriendMessages.GetActiveMessageSessions#1", &msg).await?;

        // Wait for response
        let job_response = rx.await.map_err(|_| SteamError::ResponseTimeout)?;

        let body = match job_response {
            crate::internal::jobs::JobResponse::Success(bytes) => bytes,
            crate::internal::jobs::JobResponse::Timeout => return Err(SteamError::ResponseTimeout),
            crate::internal::jobs::JobResponse::Error(msg) => return Err(SteamError::ProtocolError(msg)),
        };

        let response = steam_protos::CFriendMessagesGetActiveMessageSessionsResponse::decode(&body[..]).map_err(|_| SteamError::DeserializationFailed)?;

        let sessions = response
            .message_sessions
            .into_iter()
            .map(|s| FriendMessageSession {
                friend: SteamID::from_steam_id64(s.accountid_friend.unwrap_or(0) as u64),
                time_last_message: s.last_message.unwrap_or(0),
                time_last_view: s.last_view.unwrap_or(0),
                unread_count: s.unread_message_count.unwrap_or(0),
            })
            .collect();

        Ok(sessions)
    }

    /// Acknowledge (mark as read) a friend message.
    ///
    /// # Arguments
    /// * `friend` - The friend's SteamID
    /// * `timestamp` - Unix timestamp of the newest message to acknowledge
    pub async fn ack_friend_message(&mut self, friend: SteamID, timestamp: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CFriendMessagesAckMessageNotification { steamid_partner: Some(friend.steam_id64()), timestamp: Some(timestamp) };

        // Update local state
        self.social.write().chat_last_view.insert(friend, timestamp);

        self.send_service_method("FriendMessages.AckMessage#1", &msg).await
    }

    /// Get chat history with a friend.
    ///
    /// # Arguments
    /// * `friend` - The friend's SteamID
    /// * `start_time` - Unix timestamp to get messages from (0 to get most
    ///   recent)
    /// * `count` - Maximum number of messages to retrieve
    ///
    /// # Returns
    /// A list of messages in the conversation.
    pub async fn get_chat_history(&mut self, friend: SteamID, start_time: u32, count: u32) -> Result<Vec<HistoryMessage>, SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CFriendMessagesGetRecentMessagesRequest {
            steamid1: self.steam_id.as_ref().map(|s| s.steam_id64()),
            steamid2: Some(friend.steam_id64()),
            count: Some(count),
            most_recent_conversation: Some(start_time == 0),
            rtime32_start_time: if start_time > 0 { Some(start_time) } else { None },
            ..Default::default()
        };

        let rx = self.send_service_method_with_job("FriendMessages.GetRecentMessages#1", &msg).await?;

        // Wait for response
        let job_response = rx.await.map_err(|_| SteamError::ResponseTimeout)?;

        let body = match job_response {
            crate::internal::jobs::JobResponse::Success(bytes) => bytes,
            crate::internal::jobs::JobResponse::Timeout => return Err(SteamError::ResponseTimeout),
            crate::internal::jobs::JobResponse::Error(msg) => return Err(SteamError::ProtocolError(msg)),
        };

        let response = steam_protos::CFriendMessagesGetRecentMessagesResponse::decode(&body[..]).map_err(|_| SteamError::DeserializationFailed)?;

        let last_view_timestamp = self.social.read().chat_last_view.get(&friend).copied().unwrap_or(0);

        let messages = response
            .messages
            .into_iter()
            .map(|m| HistoryMessage {
                sender: SteamID::from_steam_id64(m.accountid.unwrap_or(0) as u64),
                timestamp: m.timestamp.unwrap_or(0),
                ordinal: m.ordinal.unwrap_or(0),
                message: m.message.unwrap_or_default(),
                unread: m.timestamp.unwrap_or(0) > last_view_timestamp,
            })
            .collect();

        Ok(messages)
    }

    /// Get the chat history for the most recent messages with a friend.
    ///
    /// # Arguments
    /// * `friend` - The friend's SteamID
    ///
    /// # Returns
    /// A list of recent messages in the conversation (up to 20).
    pub async fn get_recent_chat_history(&mut self, friend: SteamID) -> Result<Vec<HistoryMessage>, SteamError> {
        self.get_chat_history(friend, 0, 20).await
    }

    /// Helper to send a unified service method call.
    pub(crate) async fn send_service_method<T: prost::Message>(&mut self, method: &str, body: &T) -> Result<(), SteamError> {
        use crate::protocol::{ProtobufMessageHeader, SteamMessage};

        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id: self.auth.read().session_id,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            job_id_source: u64::MAX,
            job_id_target: u64::MAX,
            target_job_name: Some(method.to_string()),
            routing_appid: None,
        };

        let msg = SteamMessage::new_proto(steam_enums::EMsg::ServiceMethodCallFromClient, header, body);

        if let Some(ref mut conn) = self.connection {
            conn.send(msg.encode()).await?;
        }

        Ok(())
    }

    /// Helper to send a unified service method call with job tracking.
    pub(crate) async fn send_service_method_with_job<T: prost::Message>(&mut self, method: &str, body: &T) -> Result<tokio::sync::oneshot::Receiver<crate::internal::jobs::JobResponse>, SteamError> {
        use crate::protocol::{ProtobufMessageHeader, SteamMessage};

        info!("[SteamClient] send_service_method_with_job: method={}", method);

        // Create a job to track this request
        let (job_id, response_rx) = self.job_manager.create_job().await;
        info!("[SteamClient] send_service_method_with_job: created job_id={}", job_id);

        let header = ProtobufMessageHeader {
            header_length: 0,
            session_id: self.auth.read().session_id,
            steam_id: self.steam_id.as_ref().map(|s| s.steam_id64()).unwrap_or(0),
            job_id_source: job_id,
            job_id_target: u64::MAX,
            target_job_name: Some(method.to_string()),
            routing_appid: None,
        };

        let msg = SteamMessage::new_proto(steam_enums::EMsg::ServiceMethodCallFromClient, header, body);

        if let Some(ref mut conn) = self.connection {
            let encoded = msg.encode();
            info!("[SteamClient] send_service_method_with_job: Sending {} bytes to Steam connection", encoded.len());
            conn.send(encoded).await?;
            info!("[SteamClient] send_service_method_with_job: Sent successfully");
        } else {
            error!("[SteamClient] send_service_method_with_job: No connection available!");
            return Err(SteamError::NotConnected);
        }

        Ok(response_rx)
    }

    /// Get chat history with a friend in the background.
    ///
    /// The results will be delivered via a `ChatEvent::OfflineMessagesFetched`
    /// event.
    pub async fn get_chat_history_background(&mut self, friend: SteamID, start_time: u32, count: u32) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let msg = steam_protos::CFriendMessagesGetRecentMessagesRequest {
            steamid1: self.steam_id.as_ref().map(|s| s.steam_id64()),
            steamid2: Some(friend.steam_id64()),
            count: Some(count),
            most_recent_conversation: Some(start_time == 0),
            rtime32_start_time: if start_time > 0 { Some(start_time) } else { None },
            ..Default::default()
        };

        self.send_service_method_background("FriendMessages.GetRecentMessages#1", &msg, crate::client::steam_client::BackgroundTask::OfflineMessages(friend)).await
    }
}
