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

    pub async fn recv(&self) -> Result<Option<GameHostPacket>> {
        let Some(payload) = self.client.recv().await else {
            return Ok(None);
        };
        Ok(Some(parse_game_host_packet_for(
            &payload,
            self.steam_id,
            Some(self.player_uid),
        )?))
    }

    pub async fn send(&self, packet: Vec<u8>) -> Result<()> {
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
