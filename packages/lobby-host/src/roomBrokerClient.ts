import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
import { tracedFetch } from '@zeepkist/telemetry'

export interface RoomAssignment {
	host: string
	joinId: string
	key: string
	playerUid: number
	port: number
	roomCreated: boolean
	steamId: string
	token: string
}

export class RoomBrokerClient {
	constructor(
		private readonly url: string,
		private readonly token: string,
	) {}

	async assign(config: ManagedRoomConfig, joinId?: string): Promise<RoomAssignment> {
		const response = await tracedFetch(
			`${this.url}/v1/rooms/assignment`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ key: config.key, joinId, room: config.room }),
				signal: AbortSignal.timeout(120_000),
			},
			{ operationName: 'lobby.broker.assignment' },
		)
		if (!response.ok) throw new Error(`Room broker returned HTTP ${response.status}`)
		const assignment = parseAssignment(await response.json())
		if (assignment.key !== config.key) throw new Error('Room broker returned mismatched key')
		return assignment
	}
}

export function parseAssignment(value: unknown): RoomAssignment {
	if (typeof value !== 'object' || value === null)
		throw new Error('Room broker response is invalid')
	const assignment = value as Partial<RoomAssignment>
	if (
		typeof assignment.host !== 'string' ||
		assignment.host.length === 0 ||
		assignment.host.length > 1024 ||
		typeof assignment.joinId !== 'string' ||
		assignment.joinId.length === 0 ||
		assignment.joinId.length > 1024 ||
		typeof assignment.key !== 'string' ||
		assignment.key.length === 0 ||
		assignment.key.length > 64 ||
		typeof assignment.port !== 'number' ||
		!Number.isInteger(assignment.port) ||
		assignment.port < 1 ||
		assignment.port > 65_535 ||
		typeof assignment.roomCreated !== 'boolean' ||
		typeof assignment.playerUid !== 'number' ||
		!Number.isInteger(assignment.playerUid) ||
		assignment.playerUid < 0 ||
		assignment.playerUid > 0xffff_ffff ||
		typeof assignment.steamId !== 'string' ||
		!/^[0-9]{17,20}$/.test(assignment.steamId) ||
		typeof assignment.token !== 'string' ||
		assignment.token.length === 0 ||
		assignment.token.length > 4096
	) {
		throw new Error('Room broker response is invalid')
	}
	return assignment as RoomAssignment
}
