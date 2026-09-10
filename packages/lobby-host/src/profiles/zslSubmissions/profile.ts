import type { GameHostPacket } from '@zeepkist/core/zeepnet'
import {
	downloadSubmissionPayload,
	getSubmissionPlaylist,
} from '@zeepkist/database/services/level-submissions'
import type { LevelPayloadCache } from '../../assets/levelPayloadCache'
import type { PreparedLevel, PreparedPlaylist } from '../../assets/preparedLevel'
import { bold } from '../../chat/richText'
import type {
	LevelTransferEvent,
	ManagedLobbyProfile,
	RoomContext,
	RoomLogger,
	RoomProfileSession,
} from '../contracts'

type Snapshot = NonNullable<Awaited<ReturnType<typeof getSubmissionPlaylist>>>
export class ZslSubmissionsProfile implements ManagedLobbyProfile {
	readonly name = 'zsl-submissions'
	currentLevel: PreparedLevel | undefined
	private snapshot?: Snapshot
	private readonly held = new Map<string, PreparedLevel>()
	private stopped = false
	constructor(
		private readonly threadId: string,
		private readonly cache: LevelPayloadCache,
		private readonly log: RoomLogger,
		private readonly roundTimeSeconds: number,
	) {}
	async prepare() {
		const snapshot = await getSubmissionPlaylist(this.threadId)
		if (this.stopped) return undefined
		this.snapshot = snapshot
		if (!snapshot?.members.length) {
			this.currentLevel?.lease.release()
			this.currentLevel = undefined
			return undefined
		}
		const first = snapshot.members[0]!
		const previous = this.currentLevel
		this.currentLevel = await this.load(
			snapshot,
			first.validation.payload!.uid,
			first.workshopId,
		)
		if (previous && previous !== this.currentLevel) previous.lease.release()
		return this.currentLevel
	}
	private async load(snapshot: Snapshot, uid: string, workshopId: bigint) {
		const metadata = snapshot.members.find(
			(m) => m.workshopId === workshopId && m.validation.payload?.uid === uid,
		)?.validation.payload
		if (!metadata) return undefined
		const key = `${workshopId}:${uid}:${metadata.sha256}`
		const cached = this.held.get(key)
		if (cached) return cached
		const lease = await this.cache.acquire(metadata.sha256, () =>
			downloadSubmissionPayload(metadata),
		)
		if (this.stopped) {
			lease.release()
			return undefined
		}
		// Another overlapping request may already hold the shared buffer.
		const existing = this.held.get(key)
		if (existing) {
			lease.release()
			return existing
		}
		const level: PreparedLevel = {
			compressedData: lease.data,
			contentSha256: metadata.sha256,
			level: {
				uid,
				workshopId,
				name: metadata.name,
				author: metadata.author,
				collaborators: metadata.collaborators,
				overrideAuthorName: metadata.overrideAuthorName,
			},
			lease: {
				data: lease.data,
				release: () => {
					lease.release()
					if (this.held.get(key) === level) this.held.delete(key)
					if (this.currentLevel === level) this.currentLevel = undefined
				},
			},
		}
		this.held.set(key, level)
		return level
	}
	private playlist(snapshot: Snapshot): PreparedPlaylist {
		return {
			levels: snapshot.members.map(({ validation, workshopId }) => {
				const p = validation.payload!
				return {
					uid: p.uid,
					workshopId,
					name: p.name,
					author: p.author,
					collaborators: p.collaborators,
					overrideAuthorName: p.overrideAuthorName,
				}
			}),
			load: (uid, workshopId) => this.load(snapshot, uid, workshopId),
		}
	}
	createSession(context: RoomContext): RoomProfileSession {
		let active = this.snapshot!
		let pending: Snapshot | undefined
		let currentIndex = 0
		let stopped = false
		let poll: ReturnType<typeof setInterval> | undefined
		let message: ReturnType<typeof setInterval> | undefined
		let polling = false
		let selecting = false
		const alive = () => !stopped && !context.signal.aborted
		const overlay = async () => {
			if (alive() && context.isHost() && context.isReady())
				await context.chat.command(
					`/servermessage yellow ${this.roundTimeSeconds} ${bold('ZSL Level Contest Submissions')}\n${active.members.length} valid submissions`,
				)
		}
		const selectNext = async () => {
			if (!alive() || selecting) return
			selecting = true
			try {
				if (pending) {
					const current = active.members[currentIndex]
					active = pending
					pending = undefined
					const retainedIndex = active.members.findIndex(
						(m) =>
							m.workshopId === current?.workshopId &&
							m.validation.payload?.uid === current?.validation.payload?.uid,
					)
					// Removing the current entry selects first new entry at the next transition.
					currentIndex = Math.max(0, retainedIndex)
					await context.updatePlaylist!(
						this.playlist(active),
						currentIndex,
						retainedIndex < 0 ? 0 : (currentIndex + 1) % active.members.length,
					)
				} else
					await context.updatePlaylist!(
						this.playlist(active),
						currentIndex,
						(currentIndex + 1) % active.members.length,
					)
			} finally {
				selecting = false
			}
		}
		return {
			start: async () => {
				if (!context.activatePlaylist || !context.updatePlaylist || !context.disconnect)
					throw new Error('Playlist runtime capabilities unavailable')
				if (!active?.members.length || !this.currentLevel)
					throw new Error('Submission playlist unavailable')
				await context.activatePlaylist(this.currentLevel, this.playlist(active))
				if (!alive()) return
				await overlay()
				message = setInterval(
					() => void overlay().catch(() => this.log.warn('Showcase message failed.')),
					60_000,
				)
				poll = setInterval(() => {
					if (!alive() || polling) return
					polling = true
					void getSubmissionPlaylist(this.threadId)
						.then(async (snapshot) => {
							if (!alive() || !snapshot) return
							if (!snapshot.members.length) {
								await context.disconnect!()
								return
							}
							if (snapshot.playlist.digest !== active.playlist.digest)
								pending = snapshot
						})
						.catch(() =>
							this.log.warn(
								'Showcase playlist refresh failed; current playlist retained.',
							),
						)
						.finally(() => {
							polling = false
						})
				}, 30_000)
			},
			onPacket: (packet: GameHostPacket) => {
				if (!alive() || packet.type !== 'playlist-index') return
				if (!packet.selectNext) {
					if (packet.currentIndex >= 0 && packet.currentIndex < active.members.length)
						currentIndex = packet.currentIndex
				} else
					void selectNext().catch(() => {
						this.log.warn('Showcase next-level selection failed.')
						void context.disconnect?.().catch(() => {})
					})
			},
			onTransfer: (event: LevelTransferEvent) => {
				if (event.type === 'ready') this.currentLevel = event.level
			},
			stop: () => {
				stopped = true
				if (poll) clearInterval(poll)
				if (message) clearInterval(message)
			},
		}
	}
	stop() {
		this.stopped = true
		for (const level of this.held.values()) level.lease.release()
		this.held.clear()
	}
}
