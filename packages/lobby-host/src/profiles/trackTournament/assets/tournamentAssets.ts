import {
	downloadTrackTournamentLobbyAsset,
	getPreferredTrackTournamentLobbyAsset,
	TRACK_TOURNAMENT_TYPE,
} from '@zeepkist/database'
import { getMeter, withActiveSpan } from '@zeepkist/telemetry'
import type { LevelPayloadCache } from '../../../assets/levelPayloadCache'
import type { PreparedLevel } from '../../../assets/preparedLevel'
import type { RoomLogger } from '../../contracts'

export interface TournamentAsset extends PreparedLevel {
	idTournament: number
	tournamentEndAt: string
	tournamentSlug: string
}

export class TournamentAssets {
	current?: TournamentAsset
	private pending?: Promise<void>
	private stopped = false
	private readonly owned = new Set<TournamentAsset>()
	constructor(
		private readonly type: 'weekly' | 'monthly',
		private readonly cache: LevelPayloadCache,
		private readonly log: RoomLogger,
		attributes: Record<string, string>,
	) {
		const meter = getMeter('zeepcentraal-lobby-host')
		meter
			.createObservableGauge('zeepkist.track_tournament.asset.ready')
			.addCallback((result) => result.observe(this.current ? 1 : 0, attributes))
		meter
			.createObservableGauge('zeepkist.track_tournament.active')
			.addCallback((result) => result.observe(this.current?.idTournament ?? 0, attributes))
	}
	async refresh() {
		this.pending ??= this.load().finally(() => {
			this.pending = undefined
		})
		await this.pending
		return this.current
	}
	private async load() {
		await withActiveSpan('lobby.asset.refresh', async (span) => {
			const metadata = await getPreferredTrackTournamentLobbyAsset(
				TRACK_TOURNAMENT_TYPE[this.type],
			)
			if (this.stopped || !metadata || metadata.contentSha256 === this.current?.contentSha256)
				return
			if (metadata.byteSize < 1 || metadata.byteSize > 64 * 1024 * 1024)
				throw new Error('Prepared tournament asset size is invalid')
			const lease = await this.cache.acquire(metadata.contentSha256, () =>
				downloadTrackTournamentLobbyAsset(metadata),
			)
			if (this.stopped) {
				lease.release()
				return
			}
			const asset: TournamentAsset = {
				compressedData: lease.data,
				contentSha256: metadata.contentSha256,
				idTournament: metadata.idTournament,
				tournamentSlug: metadata.tournamentSlug,
				tournamentEndAt: metadata.tournamentEndAt,
				lease: {
					data: lease.data,
					release: () => {
						lease.release()
						this.owned.delete(asset)
					},
				},
				level: {
					author: metadata.author,
					collaborators: metadata.collaborators,
					name: metadata.levelName,
					overrideAuthorName: metadata.overrideAuthorName,
					uid: metadata.fileUid,
					workshopId: metadata.workshopId,
				},
			}
			this.current = asset
			this.owned.add(asset)
			span.addEvent('lobby.asset.ready', { 'lobby.asset.bytes': lease.data.byteLength })
			this.log.info(`Asset ready for tournament ${metadata.idTournament}.`)
		})
	}
	stop() {
		this.stopped = true
		for (const asset of this.owned) asset.lease.release()
		this.current = undefined
	}
}
