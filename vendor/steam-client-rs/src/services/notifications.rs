//! Notification handling.
//!
//! This module provides functionality to manage Steam notifications
//! including marking notifications as read and requesting notification counts.

use crate::{error::SteamError, SteamClient};

/// Notification type identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum NotificationType {
    /// Trade offer notifications.
    TradeOffers = 1,
    /// Community message notifications.
    CommunityMessages = 3,
}

impl NotificationType {
    /// Get the notification type name.
    pub fn name(&self) -> &'static str {
        match self {
            NotificationType::TradeOffers => "tradeOffers",
            NotificationType::CommunityMessages => "communityMessages",
        }
    }
}

/// A Steam notification.
#[derive(Debug, Clone)]
pub struct Notification {
    /// Notification ID.
    pub id: String,
    /// Notification type.
    pub notification_type: u32,
    /// Notification targets.
    pub targets: Vec<u32>,
    /// Body data (parsed JSON).
    pub body: Option<serde_json::Value>,
    /// Whether the notification has been read.
    pub read: bool,
    /// Timestamp when the notification was created.
    pub timestamp: Option<u64>,
    /// Whether the notification is hidden.
    pub hidden: bool,
    /// Expiry timestamp.
    pub expiry: Option<u64>,
    /// Timestamp when the notification was viewed.
    pub viewed: Option<u64>,
}

impl SteamClient {
    /// Mark specific notifications as read by their IDs.
    ///
    /// # Arguments
    ///
    /// * `notification_ids` - The IDs of notifications to mark as read
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// client.mark_notifications_read(vec!["123".to_string(), "456".to_string()]).await?;
    /// ```
    pub async fn mark_notifications_read(&mut self, notification_ids: Vec<String>) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let ids: Vec<u64> = notification_ids.iter().filter_map(|s| s.parse().ok()).collect();

        let request = steam_protos::CSteamNotificationMarkNotificationsReadNotification { timestamp: None, notification_type: None, notification_ids: ids, mark_all_read: None };

        // Send unified message
        self.send_service_method("SteamNotification.MarkNotificationsRead#1", &request).await?;

        Ok(())
    }

    /// Mark all notifications as read.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// client.mark_all_notifications_read().await?;
    /// ```
    pub async fn mark_all_notifications_read(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        let request = steam_protos::CSteamNotificationMarkNotificationsReadNotification { timestamp: None, notification_type: None, notification_ids: vec![], mark_all_read: Some(true) };

        // Send unified message
        self.send_service_method("SteamNotification.MarkNotificationsRead#1", &request).await?;

        Ok(())
    }

    /// Request notification counts from Steam.
    ///
    /// This requests item announcements, comment notifications, and offline
    /// messages. The responses will arrive via [`poll_event`] as
    /// notification events.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// client.request_notifications().await?;
    /// // Handle NewItems, NewComments events from poll_event
    /// ```
    pub async fn request_notifications(&mut self) -> Result<(), SteamError> {
        if !self.is_logged_in() {
            return Err(SteamError::NotLoggedOn);
        }

        // Request item announcements
        let item_request = steam_protos::CMsgClientRequestItemAnnouncements {};
        self.send_message(steam_enums::EMsg::ClientRequestItemAnnouncements, &item_request).await?;

        // Request comment notifications
        let comment_request = steam_protos::CMsgClientRequestCommentNotifications {};
        self.send_message(steam_enums::EMsg::ClientRequestCommentNotifications, &comment_request).await?;

        // Request offline message count
        let offline_request = steam_protos::CMsgClientRequestOfflineMessageCount {};
        self.send_message(steam_enums::EMsg::ClientChatRequestOfflineMessageCount, &offline_request).await?;

        Ok(())
    }
}
