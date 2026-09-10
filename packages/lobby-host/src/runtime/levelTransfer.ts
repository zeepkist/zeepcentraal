import {
	changeLobbyLevelsPacket,
	changeLobbyPlaylistPacket,
	type GameHostPacket,
	levelDataPacket,
	skipToLevelPacket,
} from '@zeepkist/core/zeepnet'
import { withActiveSpan } from '@zeepkist/telemetry'
import type { PreparedLevel, PreparedPlaylist } from '../assets/preparedLevel'
import type { LevelTransferEvent } from '../profiles/contracts'
import { withTimeout } from './helpers'

type Request = Extract<GameHostPacket, { type: 'level-request' }>
interface Activation {
	hash: string
	promise: Promise<void>
	reject(error: Error): void
	resolve(): void
}

export class LevelTransfer {
	active?: PreparedLevel
	pending?: PreparedLevel
	private previous?: PreparedLevel
	private previousTimer?: ReturnType<typeof setTimeout>
	private activation?: Activation
	private queue = Promise.resolve()
	private queued = 0
	private closed = false
	private playlist?: PreparedPlaylist
	constructor(
		private readonly send: (packet: Uint8Array) => Promise<void>,
		private readonly roundTime: number,
		private readonly onEvent: (event: LevelTransferEvent) => void,
		private readonly onFailure: (error: unknown) => void,
		private readonly timeoutMs = 30_000,
	) {}

	async updatePlaylist(playlist: PreparedPlaylist, currentIndex: number, nextIndex: number) {
		if (this.closed) throw new Error('GameServer connection closed')
		this.playlist = playlist
		await this.send(
			changeLobbyLevelsPacket(playlist.levels, this.roundTime, currentIndex, nextIndex),
		)
	}
	async activate(level: PreparedLevel, playlistSource?: PreparedPlaylist) {
		if (this.closed) throw new Error('GameServer connection closed')
		if (this.active?.contentSha256 === level.contentSha256) return
		if (this.activation?.hash === level.contentSha256)
			return withTimeout(
				this.activation.promise,
				this.timeoutMs,
				'Lobby level-data request timed out',
			)
		await withActiveSpan('lobby.asset.activate', async (span) => {
			this.pending = level
			let resolve = () => {}
			let reject = (_error: Error) => {}
			const promise = new Promise<void>((done, fail) => {
				resolve = done
				reject = fail
			})
			// Closing while reliable sends are pending must not produce an unhandled rejection.
			void promise.catch(() => {})
			const activation = { hash: level.contentSha256, promise, resolve, reject }
			this.activation = activation
			this.playlist = playlistSource
			const playlist = this.send(
				playlistSource
					? changeLobbyLevelsPacket(
							playlistSource.levels,
							this.roundTime,
							0,
							playlistSource.levels.length > 1 ? 1 : 0,
						)
					: changeLobbyPlaylistPacket(level.level, this.roundTime),
			)
			const skip = this.send(skipToLevelPacket(level.level))
			this.onEvent({ type: 'switch', level })
			try {
				await Promise.all([playlist, skip])
				await withTimeout(promise, this.timeoutMs, 'Lobby level-data request timed out')
			} finally {
				if (this.activation === activation) this.activation = undefined
			}
			span.addEvent('lobby.protocol.activation.completed')
		})
	}
	request(request: Request) {
		if (this.closed) return
		if (this.queued >= 8) {
			this.onFailure(new Error('Level request queue exceeded capacity'))
			return
		}
		this.queued++
		const upload = this.queue
			.then(() => this.upload(request))
			.finally(() => {
				this.queued--
			})
		this.queue = upload.catch(() => {})
		void upload.catch((error) => {
			if (!this.closed) this.onFailure(error)
		})
	}
	private async upload(request: Request) {
		if (this.closed) return
		await withActiveSpan('lobby.asset.upload', async (span) => {
			let level = this.playlist
				? await this.playlist.load(request.uid, request.workshopId)
				: undefined
			if (this.closed) {
				level?.lease.release()
				return
			}
			level ??= [this.pending, this.active, this.previous].find(
				(candidate) =>
					candidate?.level.uid === request.uid &&
					candidate.level.workshopId === request.workshopId,
			)
			if (level && this.playlist && level !== this.active) this.pending = level
			if (!level) throw new Error('GameServer requested unknown level')
			this.onEvent({ type: 'request', level })
			await this.send(levelDataPacket(request, level.compressedData))
			if (this.closed) return
			span.addEvent('lobby.asset.uploaded', {
				'lobby.asset.bytes': level.compressedData.length,
			})
			this.onEvent({ type: 'uploaded', level })
			if (this.active === level && this.pending !== level)
				this.onEvent({ type: 'repeat', level })
			if (this.pending !== level) return
			if (this.previous && this.previous !== this.active) this.previous.lease.release()
			this.previous = this.active
			if (this.previousTimer) clearTimeout(this.previousTimer)
			const previous = this.previous
			this.previousTimer = setTimeout(() => {
				if (this.previous === previous) {
					this.previous = undefined
					previous?.lease.release()
				}
				this.previousTimer = undefined
			}, 30_000)
			this.active = level
			this.pending = undefined
			this.onEvent({ type: 'ready', level })
			if (this.activation?.hash === level.contentSha256) {
				this.activation.resolve()
				this.activation = undefined
			}
		})
	}
	close(retain?: PreparedLevel, error = new Error('GameServer connection closed')) {
		if (this.closed) return
		this.closed = true
		this.activation?.reject(error)
		if (this.previousTimer) clearTimeout(this.previousTimer)
		for (const level of new Set([this.pending, this.previous, this.active]))
			if (level && level !== retain) level.lease.release()
		this.pending = this.previous = this.active = undefined
	}
}
