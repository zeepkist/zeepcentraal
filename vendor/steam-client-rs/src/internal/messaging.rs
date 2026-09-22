//! Message sending abstraction for testable Steam communication.
//!
//! This module provides a `MessageSender` trait that abstracts message sending,
//! enabling mock implementations for unit testing without actual network
//! connections.
//!
//! # Example
//!
//! ```rust,ignore
//! use steam_client::messaging::{MessageSender, MockMessageSender, SessionInfo};
//!
//! // Create a mock sender for testing
//! let mut sender = MockMessageSender::new_logged_in(12345, 76561198012345678);
//!
//! // Use it in tests - messages are recorded for inspection
//! sender.send_message(EMsg::ClientChangeStatus, &body).await?;
//!
//! // Verify what was sent
//! assert_eq!(sender.sent_messages.len(), 1);
//! assert_eq!(sender.sent_messages[0].msg_type, EMsg::ClientChangeStatus);
//! ```

use async_trait::async_trait;
use prost::Message;
use steam_enums::EMsg;

use crate::error::SteamError;

/// Session information needed for building message headers.
#[derive(Debug, Clone, Copy, Default)]
pub struct SessionInfo {
    /// The client session ID.
    pub session_id: i32,
    /// The Steam ID (as u64).
    pub steam_id: u64,
}

impl SessionInfo {
    /// Create a new session info.
    pub fn new(session_id: i32, steam_id: u64) -> Self {
        Self { session_id, steam_id }
    }
}

/// Record of a sent message for test inspection.
#[derive(Debug, Clone)]
pub struct SentMessage {
    /// The message type.
    pub msg_type: EMsg,
    /// The encoded message body.
    pub body: Vec<u8>,
    /// Job ID if this was a job-tracked message.
    pub job_id: Option<u64>,
    /// Service method name if this was a service call.
    pub service_method: Option<String>,
}

/// Trait for sending Steam protocol messages.
///
/// This trait abstracts message sending, enabling mock implementations
/// for unit testing without actual network connections.
///
/// # Example
///
/// ```rust,ignore
/// async fn set_persona<S: MessageSender>(
///     sender: &mut S,
///     state: EPersonaState,
/// ) -> Result<(), SteamError> {
///     if !sender.is_logged_in() {
///         return Err(SteamError::NotLoggedOn);
///     }
///
///     let msg = CMsgClientChangeStatus {
///         persona_state: Some(state as u32),
///         ..Default::default()
///     };
///
///     sender.send_message(EMsg::ClientChangeStatus, &msg).await
/// }
/// ```
#[async_trait]
pub trait MessageSender: Send {
    /// Check if currently logged in.
    fn is_logged_in(&self) -> bool;

    /// Get session info for building headers.
    fn session_info(&self) -> SessionInfo;

    /// Send a protobuf message.
    ///
    /// # Arguments
    /// * `msg_type` - The Steam message type (EMsg)
    /// * `body` - The protobuf message body
    async fn send_message<T: Message + Send + Sync>(&mut self, msg_type: EMsg, body: &T) -> Result<(), SteamError>;

    /// Send a service method call (unified messages).
    ///
    /// # Arguments
    /// * `method` - The service method name (e.g., "Player.IgnoreFriend#1")
    /// * `body` - The protobuf request body
    async fn send_service_method<T: Message + Send + Sync>(&mut self, method: &str, body: &T) -> Result<(), SteamError>;
}

/// Mock message sender for testing.
///
/// Records all sent messages for inspection and verification in tests.
/// Can be configured to simulate logged-in or logged-out state.
///
/// # Example
///
/// ```rust,ignore
/// let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);
///
/// // Simulate sending a message
/// mock.send_message(EMsg::ClientChangeStatus, &body).await?;
///
/// // Verify the message was sent
/// assert_eq!(mock.sent_messages.len(), 1);
/// assert_eq!(mock.sent_messages[0].msg_type, EMsg::ClientChangeStatus);
///
/// // Decode the body for detailed verification
/// let sent_body: CMsgClientChangeStatus = mock.decode_last_message()?;
/// assert_eq!(sent_body.persona_state, Some(1));
/// ```
#[derive(Debug, Default)]
pub struct MockMessageSender {
    /// Whether the mock is in "logged in" state.
    pub logged_in: bool,
    /// Session information.
    pub session_info: SessionInfo,
    /// All messages sent through this mock.
    pub sent_messages: Vec<SentMessage>,
    /// If set, next send will return this error.
    pub next_error: Option<SteamError>,
    /// Current job ID source for simulation.
    pub current_job_id: u64,
}

impl MockMessageSender {
    /// Create a new mock sender in logged-out state.
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a mock sender in logged-in state.
    pub fn new_logged_in(session_id: i32, steam_id: u64) -> Self {
        Self {
            logged_in: true,
            session_info: SessionInfo::new(session_id, steam_id),
            sent_messages: Vec::new(),
            next_error: None,
            current_job_id: 0,
        }
    }

    /// Set whether this mock is "logged in".
    pub fn set_logged_in(&mut self, logged_in: bool) {
        self.logged_in = logged_in;
    }

    /// Make the next send call return an error.
    pub fn set_next_error(&mut self, error: SteamError) {
        self.next_error = Some(error);
    }

    /// Clear all recorded messages.
    pub fn clear(&mut self) {
        self.sent_messages.clear();
    }

    /// Get the last sent message, if any.
    pub fn last_sent(&self) -> Option<&SentMessage> {
        self.sent_messages.last()
    }

    /// Decode the body of the last sent message.
    ///
    /// Useful for verifying the exact content of sent messages in tests.
    pub fn decode_last_message<T: Message + Default>(&self) -> Result<T, SteamError> {
        let msg = self.last_sent().ok_or_else(|| SteamError::Other("No messages sent".into()))?;
        T::decode(&msg.body[..]).map_err(|e| SteamError::ProtocolError(format!("Failed to decode: {}", e)))
    }

    /// Get messages of a specific type.
    pub fn messages_of_type(&self, msg_type: EMsg) -> Vec<&SentMessage> {
        self.sent_messages.iter().filter(|m| m.msg_type == msg_type).collect()
    }

    /// Get service method calls.
    pub fn service_calls(&self) -> Vec<&SentMessage> {
        self.sent_messages.iter().filter(|m| m.service_method.is_some()).collect()
    }
}

#[async_trait]
impl MessageSender for MockMessageSender {
    fn is_logged_in(&self) -> bool {
        self.logged_in
    }

    fn session_info(&self) -> SessionInfo {
        self.session_info
    }

    async fn send_message<T: Message + Send + Sync>(&mut self, msg_type: EMsg, body: &T) -> Result<(), SteamError> {
        // Check for injected error
        if let Some(error) = self.next_error.take() {
            return Err(error);
        }

        // Increment job ID to simulate real client behavior
        self.current_job_id += 1;

        // Record the message
        self.sent_messages.push(SentMessage { msg_type, body: body.encode_to_vec(), job_id: Some(self.current_job_id), service_method: None });

        Ok(())
    }

    async fn send_service_method<T: Message + Send + Sync>(&mut self, method: &str, body: &T) -> Result<(), SteamError> {
        // Check for injected error
        if let Some(error) = self.next_error.take() {
            return Err(error);
        }

        // Increment job ID to simulate real client behavior
        self.current_job_id += 1;

        // Record the service call
        self.sent_messages.push(SentMessage {
            msg_type: EMsg::ServiceMethodCallFromClient,
            body: body.encode_to_vec(),
            job_id: Some(self.current_job_id),
            service_method: Some(method.to_string()),
        });

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use steam_protos::CMsgClientChangeStatus;

    use super::*;

    #[tokio::test]
    async fn test_mock_sender_records_messages() {
        let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);

        let body = CMsgClientChangeStatus { persona_state: Some(1), ..Default::default() };

        mock.send_message(EMsg::ClientChangeStatus, &body).await.expect("test should not fail");

        assert_eq!(mock.sent_messages.len(), 1);
        assert_eq!(mock.sent_messages[0].msg_type, EMsg::ClientChangeStatus);
        assert!(mock.sent_messages[0].service_method.is_none());
    }

    #[tokio::test]
    async fn test_mock_sender_decode_last_message() {
        let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);

        let body = CMsgClientChangeStatus { persona_state: Some(3), player_name: Some("TestPlayer".to_string()), ..Default::default() };

        mock.send_message(EMsg::ClientChangeStatus, &body).await.expect("test should not fail");

        let decoded: CMsgClientChangeStatus = mock.decode_last_message().expect("test should not fail");
        assert_eq!(decoded.persona_state, Some(3));
        assert_eq!(decoded.player_name, Some("TestPlayer".to_string()));
    }

    #[tokio::test]
    async fn test_mock_sender_service_method() {
        let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);

        let body = steam_protos::CPlayerGetNicknameListRequest {};
        mock.send_service_method("Player.GetNicknameList#1", &body).await.expect("test should not fail");

        assert_eq!(mock.sent_messages.len(), 1);
        assert_eq!(mock.sent_messages[0].service_method, Some("Player.GetNicknameList#1".to_string()));
        assert_eq!(mock.sent_messages[0].msg_type, EMsg::ServiceMethodCallFromClient);
    }

    #[tokio::test]
    async fn test_mock_sender_error_injection() {
        let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);
        mock.set_next_error(SteamError::NotConnected);

        let body = CMsgClientChangeStatus::default();
        let result = mock.send_message(EMsg::ClientChangeStatus, &body).await;

        assert!(result.is_err());
        assert!(mock.sent_messages.is_empty()); // Message not recorded on error
    }

    #[tokio::test]
    async fn test_mock_sender_is_logged_in() {
        let mock_out = MockMessageSender::new();
        assert!(!mock_out.is_logged_in());

        let mock_in = MockMessageSender::new_logged_in(123, 456);
        assert!(mock_in.is_logged_in());
    }

    #[tokio::test]
    async fn test_mock_sender_session_info() {
        let mock = MockMessageSender::new_logged_in(12345, 76561198012345678);
        let info = mock.session_info();

        assert_eq!(info.session_id, 12345);
        assert_eq!(info.steam_id, 76561198012345678);
    }

    #[tokio::test]
    async fn test_mock_sender_messages_of_type() {
        let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);

        mock.send_message(EMsg::ClientChangeStatus, &CMsgClientChangeStatus::default()).await.expect("test should not fail");
        mock.send_message(EMsg::ClientHeartBeat, &steam_protos::CMsgClientHeartBeat::default()).await.expect("test should not fail");
        mock.send_message(EMsg::ClientChangeStatus, &CMsgClientChangeStatus::default()).await.expect("test should not fail");

        let status_msgs = mock.messages_of_type(EMsg::ClientChangeStatus);
        assert_eq!(status_msgs.len(), 2);

        let heartbeat_msgs = mock.messages_of_type(EMsg::ClientHeartBeat);
        assert_eq!(heartbeat_msgs.len(), 1);
    }

    #[tokio::test]
    async fn test_mock_sender_clear() {
        let mut mock = MockMessageSender::new_logged_in(12345, 76561198012345678);

        mock.send_message(EMsg::ClientChangeStatus, &CMsgClientChangeStatus::default()).await.expect("test should not fail");
        assert_eq!(mock.sent_messages.len(), 1);

        mock.clear();
        assert!(mock.sent_messages.is_empty());
    }
}
