import type { GameHostPacket } from '@zeepkist/core/zeepnet'
import type { RoomContext } from '../../contracts'
import type { TrackTournamentPlayerContext } from '../leaderboard/trackTournamentLeaderboard'
import {
	buildTrackTournamentJoinMessage,
	type TrackTournamentRoomType,
} from './trackTournamentMessages'

export async function sendTournamentWelcome(
	context: Pick<RoomContext, 'signal' | 'isReady' | 'isHost' | 'chat' | 'logger' | 'getPlayers'>,
	packet: Extract<GameHostPacket, { type: 'player-connected' }>,
	type: TrackTournamentRoomType,
	getTournament: () => number | undefined,
	lookup: (
		tournament: number,
		steamId: bigint,
		recentSince: string,
	) => Promise<TrackTournamentPlayerContext>,
) {
	const canSend = () =>
		!context.signal.aborted &&
		context.isReady() &&
		context.isHost() &&
		context.getPlayers().some((p) => p.uid === packet.uid && p.steamId === packet.steamId)
	for (let attempt = 0; attempt < 2; attempt++) {
		const tournamentId = getTournament()
		if (!tournamentId || !canSend()) return
		let playerContext: TrackTournamentPlayerContext
		try {
			playerContext = await lookup(
				tournamentId,
				packet.steamId,
				new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString(),
			)
		} catch {
			playerContext = { minimumGtrVersion: null, recentRecord: false, userExists: false }
		}
		if (!canSend()) return
		if (getTournament() !== tournamentId) {
			if (attempt === 0) continue
			return
		}
		const rich = buildTrackTournamentJoinMessage({
			minimumGtrVersion: playerContext.minimumGtrVersion,
			playerName: packet.username?.trim() || packet.backupName,
			requireGtr: !playerContext.userExists || !playerContext.recentRecord,
			standing: playerContext.standing,
			type,
		})
		await context.chat.target(packet.steamId, rich.message, rich.hostname)
		context.logger.info('Targeted join message sent.')
		return
	}
}
