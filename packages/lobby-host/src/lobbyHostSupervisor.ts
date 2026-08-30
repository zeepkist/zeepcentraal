import type { LobbyHostFileConfig, ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
import { LevelPayloadCache } from './levelPayloadCache'
import { ManagedLobbyHost } from './managedLobbyHost'
import { RoomBrokerClient } from './roomBrokerClient'
import { TrackTournamentLeaderboardHub } from './trackTournamentLeaderboard'

interface SupervisorConfig {
	brokerToken: string
	brokerUrl: string
	file: LobbyHostFileConfig
	graphqlWsUrl: string
}

interface SharedResources {
	broker: RoomBrokerClient
	leaderboard: TrackTournamentLeaderboardHub
	payloads: LevelPayloadCache
}

interface SupervisorDependencies {
	broker?: RoomBrokerClient
	createHost?: (
		config: ManagedRoomConfig,
		shared: SharedResources,
	) => Pick<ManagedLobbyHost, 'run' | 'stop'>
	leaderboard?: TrackTournamentLeaderboardHub
	payloads?: LevelPayloadCache
	restartDelayMs?: number
}

export class LobbyHostSupervisor {
	private readonly leaderboard: TrackTournamentLeaderboardHub
	private readonly hosts: Array<{
		host: Pick<ManagedLobbyHost, 'run' | 'stop'>
		key: string
	}>
	private readonly restartDelayMs: number
	private runPromise: Promise<void> | undefined
	private stopped = false
	private stopPromise: Promise<void> | undefined

	constructor(config: SupervisorConfig, dependencies: SupervisorDependencies = {}) {
		const broker =
			dependencies.broker ?? new RoomBrokerClient(config.brokerUrl, config.brokerToken)
		this.leaderboard =
			dependencies.leaderboard ??
			new TrackTournamentLeaderboardHub(config.graphqlWsUrl, (error) => {
				console.warn(
					`Track tournament leaderboard subscription failed: ${safeError(error)}`,
				)
			})
		const shared = {
			broker,
			leaderboard: this.leaderboard,
			payloads: dependencies.payloads ?? new LevelPayloadCache(),
		}
		const createHost = dependencies.createHost ?? ((room) => new ManagedLobbyHost(room, shared))
		this.hosts = config.file.rooms.map((room) => ({
			host: createHost(room, shared),
			key: room.key,
		}))
		this.restartDelayMs = dependencies.restartDelayMs ?? 1_000
	}

	async run() {
		this.runPromise ??= Promise.all(
			this.hosts.map(({ host, key }) => this.superviseHost(host, key)),
		).then(() => undefined)
		await this.runPromise
	}

	stop() {
		this.stopPromise ??= this.stopOnce()
		return this.stopPromise
	}

	private async stopOnce() {
		this.stopped = true
		const results = await Promise.allSettled(this.hosts.map(({ host }) => host.stop()))
		await this.leaderboard.close()
		const failure = results.find(
			(result): result is PromiseRejectedResult => result.status === 'rejected',
		)
		if (failure) throw failure.reason
	}

	private async superviseHost(host: Pick<ManagedLobbyHost, 'run' | 'stop'>, key: string) {
		while (!this.stopped) {
			try {
				await host.run()
				if (!this.stopped)
					console.warn(`[${key}] Managed room stopped unexpectedly; restarting.`)
			} catch (error) {
				if (!this.stopped)
					console.warn(`[${key}] Managed room failed; restarting: ${safeError(error)}`)
			}
			if (!this.stopped) await delay(this.restartDelayMs)
		}
	}
}

function safeError(error: unknown) {
	return (error instanceof Error ? error.message : 'Unknown error')
		.replace(/[\r\n\t]/g, ' ')
		.slice(0, 200)
}

function delay(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
