import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
import type { GameHostPacket } from '@zeepkist/core/zeepnet'
import type { LevelPayloadCache } from '../../assets/levelPayloadCache'
import { MessageScheduler } from '../../chat/messageScheduler'
import { safeError } from '../../runtime/helpers'
import type {
	LevelTransferEvent,
	ManagedLobbyProfile,
	RoomContext,
	RoomLogger,
	RoomProfileSession,
} from '../contracts'
import { type TournamentAsset, TournamentAssets } from './assets/tournamentAssets'
import {
	buildTrackTournamentServerMessageCommand,
	leaderboardSignature,
	type TrackTournamentLeaderboardStanding,
} from './chat/trackTournamentMessages'
import { sendTournamentWelcome } from './chat/welcome'
import { TournamentPlayerLeaderboard } from './leaderboard/tournamentPlayerLeaderboard'
import type { TrackTournamentLeaderboardHub } from './leaderboard/trackTournamentLeaderboard'

export interface TournamentDependencies {
	leaderboard: TrackTournamentLeaderboardHub
	payloads: LevelPayloadCache
}

export class TrackTournamentProfile implements ManagedLobbyProfile {
	readonly name: string
	readonly assets: TournamentAssets
	constructor(
		private readonly config: ManagedRoomConfig,
		private readonly shared: TournamentDependencies,
		private readonly log: RoomLogger,
	) {
		this.name = `${config.profile.type}.${config.profile.tournamentType}`
		this.assets = new TournamentAssets(config.profile.tournamentType, shared.payloads, log, {
			'room.key': config.key,
			'room.profile': this.name,
		})
	}
	get currentLevel() {
		return this.assets.current
	}
	async prepare() {
		const level = await this.assets.refresh()
		if (!level) this.log.warn('Tournament asset unavailable; waiting before room assignment.')
		return level
	}
	createSession(context: RoomContext) {
		return new TrackTournamentSession(
			this.config,
			this.shared.leaderboard,
			this.assets,
			context,
		)
	}
	stop() {
		this.assets.stop()
	}
}

class TrackTournamentSession implements RoomProfileSession {
	private stopped = false
	private poll?: ReturnType<typeof setInterval>
	private stopWatch?: () => void
	private watchedTournamentId?: number
	private entries?: number
	private standings?: TrackTournamentLeaderboardStanding[]
	private signature?: string
	private gameState?: number
	private readonly messages: MessageScheduler
	private readonly players: TournamentPlayerLeaderboard
	constructor(
		private readonly config: ManagedRoomConfig,
		private readonly hub: TrackTournamentLeaderboardHub,
		private readonly assets: TournamentAssets,
		private readonly context: RoomContext,
	) {
		this.messages = new MessageScheduler(
			() => this.sendServerMessage(),
			(error) => {
				context.logger.warn(`Server message failed: ${safeError(error)}`)
				this.messages.refresh(30_000)
			},
		)
		this.players = new TournamentPlayerLeaderboard(
			context.send,
			(ids) => hub.setPlayers(config.key, ids),
			() => context.logger.warn('Tournament leaderboard synchronization failed; retrying.'),
			context.localSteamId,
			{
				type: config.profile.tournamentType,
				onError: () => context.logger.warn('Targeted standing notification failed.'),
			},
			context.createLeaderboard,
		)
	}
	async start() {
		const asset = this.assets.current
		if (!asset) throw new Error('Tournament asset became unavailable')
		await this.context.activate(asset)
		if (this.stopped) return
		await this.context.chat.command('/joinmessage off')
		this.context.logger.info('Built-in join message disabled.')
		await this.sendServerMessage()
		this.context.logger.info(`Managed room connected for tournament ${asset.idTournament}.`)
		let refreshing = false
		this.poll = setInterval(() => {
			if (this.stopped || refreshing) return
			refreshing = true
			void this.assets
				.refresh()
				.then(async (next) => {
					if (!this.stopped && next) await this.context.activate(next)
				})
				.catch((error) => {
					if (!this.stopped)
						this.context.logger.warn(`Asset refresh failed: ${safeError(error)}`)
				})
				.finally(() => {
					refreshing = false
				})
		}, this.config.assetPollMs)
	}
	onPacket(packet: GameHostPacket) {
		if (this.stopped) return
		this.players.observe(packet)
		if (packet.type === 'player-connected')
			void sendTournamentWelcome(
				this.context,
				packet,
				this.config.profile.tournamentType,
				() => this.assets.current?.idTournament,
				this.hub.lookupPlayerContext.bind(this.hub),
			).catch((error) =>
				this.context.logger.warn(`Targeted join message failed: ${safeError(error)}`),
			)
		if (packet.type === 'game-state') {
			const started = packet.state === 0 && this.gameState !== 0
			this.gameState = packet.state
			if (started && this.context.isReady()) {
				this.players.setReady(true)
				this.queueMessage(1_000)
			}
		}
	}
	onTransfer(event: LevelTransferEvent) {
		if (this.stopped) return
		const asset = event.level as TournamentAsset
		const log = this.context.logger
		if (event.type === 'switch') {
			this.players.setReady(false)
			log.info(`Playlist and level switch sent for tournament ${asset.idTournament}.`)
		}
		if (event.type === 'request')
			log.info(`Level-data request received for tournament ${asset.idTournament}.`)
		if (event.type === 'uploaded')
			log.info(
				`Level data uploaded for tournament ${asset.idTournament} (${asset.compressedData.length} bytes).`,
			)
		if (event.type === 'repeat') this.queueMessage(1_000)
		if (event.type === 'ready') {
			this.players.setTournament(asset.idTournament, asset.level.uid)
			this.watch(asset.idTournament)
			this.players.refreshRoster()
			this.players.setReady(true)
			log.info(`Ready for tournament ${asset.idTournament}.`)
		}
	}
	private watch(id: number) {
		if (this.watchedTournamentId === id) return
		this.stopWatch?.()
		this.watchedTournamentId = id
		this.entries = this.standings = this.signature = undefined
		this.stopWatch = this.hub.watch(this.config.key, id, (snapshot) => {
			if (this.stopped || this.watchedTournamentId !== id) return
			if (snapshot.connectedPlayers) this.players.setResults(snapshot.connectedPlayers)
			const signature = leaderboardSignature(snapshot.standings, snapshot.entries)
			if (signature === this.signature) return
			this.entries = snapshot.entries
			this.standings = snapshot.standings
			this.signature = signature
			this.queueMessage(1_000)
		})
	}
	private queueMessage(ms: number) {
		if (!this.stopped && this.context.isReady() && this.assets.current)
			this.messages.request(ms)
	}
	private async sendServerMessage() {
		const asset = this.assets.current
		if (this.stopped || !this.context.isReady() || !asset) return
		await this.context.chat.command(
			buildTrackTournamentServerMessageCommand(
				this.config.profile.tournamentType,
				asset.tournamentSlug,
				asset.tournamentEndAt,
				this.standings,
				this.entries,
				this.config.roundTimeSeconds,
			),
		)
		this.messages.refresh(this.config.messageRefreshMs)
		this.context.logger.info(`Server message sent for tournament ${asset.idTournament}.`)
	}
	stop() {
		if (this.stopped) return
		this.stopped = true
		if (this.poll) clearInterval(this.poll)
		this.stopWatch?.()
		this.messages.close()
		this.players.close()
	}
}
