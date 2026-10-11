use crate::broker::RoomAssignment;
use anyhow::{Context, Result, ensure};
use std::net::SocketAddr;
use tokio::net::lookup_host;
use zc_core::zeepnet::{
    BitWriter, GameHostPacket, LidgrenClient, LidgrenClientOptions, parse_game_host_packet_for,
};

pub struct GameConnection {
    client: LidgrenClient,
    steam_id: u64,
    player_uid: u32,
}

impl GameConnection {
    pub async fn connect(assignment: &RoomAssignment) -> Result<Self> {
        let remote = resolve_remote(&assignment.host, assignment.port).await?;
        let mut hail = BitWriter::new();
        hail.write_string(&assignment.token)?;
        let client =
            LidgrenClient::start(LidgrenClientOptions::game_server(remote, hail.into_bytes()))
                .await?;
        client.connect().await?;
        Ok(Self {
            client,
            steam_id: assignment.steam_id()?,
            player_uid: assignment.player_uid,
        })
    }

    pub fn remote_clock(&self) -> zc_core::zeepnet::RemoteClock {
        self.client.remote_clock()
    }

    pub async fn recv(&self) -> Result<Option<GameHostPacket>> {
        let Some(payload) = self.client.recv().await else {
            // Preserve transport/remote failures instead of replacing every failure
            // with the receive loop's generic "GameServer connection closed".
            self.client.wait_for_close().await?;
            return Ok(None);
        };
        Ok(Some(parse_game_host_packet_for(
            &payload,
            self.steam_id,
            Some(self.player_uid),
        )?))
    }

    pub async fn send(&self, packet: Vec<u8>) -> Result<()> {
        ensure!(
            packet.get(..2)
                != Some(
                    zc_core::zeepnet::CHANGE_LOBBY_GAME_PROPERTIES
                        .to_le_bytes()
                        .as_slice()
                ),
            "Cannot send server-only GameProperties packet"
        );
        self.client.send_reliable_ordered(packet, 0).await?;
        Ok(())
    }

    pub async fn close(&self, reason: &str) -> Result<()> {
        self.client.close(reason).await?;
        Ok(())
    }

    pub async fn wait_for_close(&self) -> Result<()> {
        self.client.wait_for_close().await?;
        Ok(())
    }
}

async fn resolve_remote(host: &str, port: u16) -> Result<SocketAddr> {
    ensure!(
        !host.is_empty() && host.len() <= 1_024,
        "Invalid game server host"
    );
    lookup_host((host, port))
        .await
        .context("resolve game server host")?
        .next()
        .context("game server host resolved to no addresses")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::{net::UdpSocket, time::timeout};
    use zc_core::zeepnet::{LidgrenDisconnectCategory, LidgrenError};

    #[tokio::test]
    async fn receive_preserves_remote_disconnect_and_malformed_transport_errors() -> Result<()> {
        let mut reason = BitWriter::new();
        reason.write_string("Host packet rejected")?;
        let payload = reason.into_bytes();
        let bits = u16::try_from(payload.len() * 8)?;
        let mut disconnect = vec![135, 0, 0];
        disconnect.extend_from_slice(&bits.to_le_bytes());
        disconnect.extend_from_slice(&payload);
        for (packet, expected) in [
            (
                disconnect,
                LidgrenError::RemoteDisconnect {
                    reason: "Host packet rejected".into(),
                    category: LidgrenDisconnectCategory::Remote,
                },
            ),
            (vec![67], LidgrenError::MalformedMessage),
        ] {
            let server = UdpSocket::bind("127.0.0.1:0").await?;
            let client = LidgrenClient::start(LidgrenClientOptions::game_server(
                server.local_addr()?,
                vec![],
            ))
            .await?;
            let connection = GameConnection {
                client,
                steam_id: 1,
                player_uid: 1,
            };
            assert_eq!(
                connection
                    .send(
                        zc_core::zeepnet::CHANGE_LOBBY_GAME_PROPERTIES
                            .to_le_bytes()
                            .to_vec()
                    )
                    .await
                    .unwrap_err()
                    .to_string(),
                "Cannot send server-only GameProperties packet"
            );
            let mut buffer = [0; 2048];
            let (_, address) =
                timeout(Duration::from_secs(1), server.recv_from(&mut buffer)).await??;
            server.send_to(&packet, address).await?;
            let error = timeout(Duration::from_secs(1), connection.recv())
                .await?
                .unwrap_err();
            assert_eq!(error.downcast_ref::<LidgrenError>(), Some(&expected));
        }
        Ok(())
    }
}
