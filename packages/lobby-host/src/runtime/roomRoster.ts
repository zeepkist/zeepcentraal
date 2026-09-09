import type { GameHostPacket, GameHostPlayer } from '@zeepkist/core/zeepnet'
export class RoomRoster {
	private readonly players = new Map<number, GameHostPlayer>()
	observe(packet: GameHostPacket) {
		if (packet.type === 'initial') {
			this.players.clear()
			for (const player of packet.players) this.players.set(player.uid, player)
		}
		if (packet.type === 'player-connected') this.players.set(packet.uid, packet)
		if (packet.type === 'player-disconnected') this.players.delete(packet.uid)
	}
	all() {
		return [...this.players.values()]
	}
	names() {
		return new Map(
			this.all().map((p) => [p.uid, `${p.playerTag}${p.username?.trim() || p.backupName}`]),
		)
	}
	clear() {
		this.players.clear()
	}
}
