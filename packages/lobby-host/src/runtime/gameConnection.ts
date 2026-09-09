import {
	BitWriter,
	type GameHostPacket,
	LidgrenClient,
	parseGameHostPacket,
} from '@zeepkist/core/zeepnet'
import type { RoomAssignment } from '../broker/roomBrokerClient'

/** Hail and account identity stay inside the connection adapter, never profile events. */
export function createGameClient(
	assignment: RoomAssignment,
	onPacket: (packet: GameHostPacket) => void,
) {
	const hail = new BitWriter()
	hail.writeString(assignment.token)
	const client = new LidgrenClient({
		applicationIdentifier: 'GameServer',
		host: assignment.host,
		port: assignment.port,
		hail: hail.toUint8Array(),
		onPayload: (payload) => {
			try {
				const packet = parseGameHostPacket(
					payload,
					BigInt(assignment.steamId),
					assignment.playerUid,
				)
				if (packet) onPacket(packet)
			} catch {
				void client.close('Invalid game server packet')
			}
		},
	})
	return client
}
