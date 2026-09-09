import type { GameHostPacket, GameHostPlayer, LeaderboardOverrides } from '@zeepkist/core/zeepnet'
import { PlayerLeaderboard } from '../../../leaderboard/playerLeaderboard'
import { TournamentStandingNotifications } from '../chat/tournamentStandingNotifications'
import {
	escapeUnityRichText,
	formatTrackTournamentTime,
	type TrackTournamentRoomType,
} from '../chat/trackTournamentMessages'
import type { TournamentPlayerResult } from './trackTournamentLeaderboard'

export class TournamentPlayerLeaderboard {
	private readonly projection: PlayerLeaderboard
	private readonly notifications?: TournamentStandingNotifications
	private results = new Map<string, TournamentPlayerResult>()
	private tournamentId?: number
	constructor(
		send: (packet: Uint8Array) => Promise<void>,
		onRoster: (ids: bigint[]) => void,
		onError: () => void,
		localSteamId: bigint,
		notifications?: { type: TrackTournamentRoomType; onError: () => void },
		createProjection?: (
			onRoster: (ids: bigint[]) => void,
			onError: () => void,
		) => PlayerLeaderboard,
	) {
		if (notifications)
			this.notifications = new TournamentStandingNotifications(
				notifications.type,
				send,
				notifications.onError,
			)
		const rosterChanged = (ids: bigint[]) => {
			this.notifications?.setRoster(ids)
			for (const id of this.results.keys())
				if (!ids.includes(BigInt(id))) this.results.delete(id)
			this.publish()
			onRoster(ids)
		}
		this.projection = createProjection
			? createProjection(rosterChanged, onError)
			: new PlayerLeaderboard(send, rosterChanged, onError, localSteamId)
	}
	setTournament(id: number, uid: string) {
		if (id !== this.tournamentId) {
			this.results.clear()
			this.notifications?.reset()
			this.tournamentId = id
		}
		this.projection.setScope(String(id), uid)
		this.publish()
	}
	setReady(ready: boolean) {
		this.notifications?.setReady(ready)
		this.projection.setReady(ready)
	}
	setRoster(players: GameHostPlayer[]) {
		this.projection.setRoster(players)
	}
	refreshRoster() {
		this.projection.refreshRoster()
	}
	setResults(results: TournamentPlayerResult[]) {
		this.notifications?.update(results)
		this.results = new Map(results.map((result) => [result.steamId, result]))
		this.publish()
	}
	observe(packet: GameHostPacket) {
		this.projection.observe(packet)
	}
	close() {
		this.notifications?.close()
		this.projection.close()
		this.results.clear()
	}
	private publish() {
		this.projection.setDesired(
			this.projection.getPlayers().map((player) => {
				const result = this.results.get(player.steamId.toString())
				return {
					steamId: player.steamId.toString(),
					time: result?.time,
					overrides: tournamentLeaderboardOverrides(player, result),
				}
			}),
		)
	}
}

export function tournamentLeaderboardOverrides(
	player: GameHostPlayer,
	result?: TournamentPlayerResult,
): LeaderboardOverrides {
	const name = [
		...`${player.playerTag}${player.username || player.backupName}`.replace(
			/[\p{Cc}\p{Cf}]/gu,
			'',
		),
	]
		.slice(0, 80)
		.join('')
	return {
		time: result ? formatTrackTournamentTime(result.time) : '',
		position: result ? String(result.rank) : '—',
		name: `<nobr>${escapeUnityRichText(name)}</nobr>`,
		points: `${result?.points ?? 0} pts`,
		pointsWon: ' ',
	}
}
