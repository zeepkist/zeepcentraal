import { targetedChatMessagePacket } from '@zeepkist/core/zeepnet'
import { bold, color, lineBreak, size } from '../../../chat/richText'
import type { TournamentPlayerResult } from '../leaderboard/trackTournamentLeaderboard'
import { formatTrackTournamentTime, type TrackTournamentRoomType } from './trackTournamentMessages'

interface PendingChange {
	current: TournamentPlayerResult
	previous: TournamentPlayerResult | undefined
	timer: ReturnType<typeof setTimeout>
}

/** Accepted-result notifications, independent of GameServer echoes and projection retries. */
export class TournamentStandingNotifications {
	private readonly baselines = new Map<string, TournamentPlayerResult | undefined>()
	private readonly pending = new Map<string, PendingChange>()
	private roster = new Set<string>()
	private ready = false
	private closed = false

	constructor(
		private readonly type: TrackTournamentRoomType,
		private readonly send: (packet: Uint8Array) => Promise<void>,
		private readonly onError: () => void,
		private readonly windowMs = 1_000,
	) {}

	setRoster(ids: readonly bigint[]) {
		this.roster = new Set(ids.map(String))
		for (const id of this.baselines.keys()) {
			if (!this.roster.has(id)) {
				this.baselines.delete(id)
				this.cancel(id)
			}
		}
	}

	setReady(ready: boolean) {
		this.ready = ready
		if (!ready) for (const id of this.pending.keys()) this.cancel(id)
	}

	reset() {
		for (const id of this.pending.keys()) this.cancel(id)
		this.baselines.clear()
	}

	close() {
		this.closed = true
		this.reset()
		this.roster.clear()
	}

	update(results: readonly TournamentPlayerResult[]) {
		if (this.closed) return
		const next = new Map(results.map((result) => [result.steamId, { ...result }]))
		for (const id of this.roster) {
			const initialized = this.baselines.has(id)
			const previous = this.baselines.get(id)
			const current = next.get(id)
			this.baselines.set(id, current)
			if (!current) {
				this.cancel(id)
				continue
			}
			if (!initialized || !this.ready) continue
			const pending = this.pending.get(id)
			if (pending) {
				// Keep the original deadline and baseline even if changes temporarily cancel out.
				pending.current = current
			} else if (shouldNotify(previous, current)) {
				this.pending.set(id, {
					previous,
					current,
					timer: setTimeout(() => this.flush(id), this.windowMs),
				})
			}
		}
	}

	private cancel(id: string) {
		const pending = this.pending.get(id)
		if (pending) clearTimeout(pending.timer)
		this.pending.delete(id)
	}

	private flush(id: string) {
		const pending = this.pending.get(id)
		this.pending.delete(id)
		if (
			!pending ||
			this.closed ||
			!this.ready ||
			!this.roster.has(id) ||
			!shouldNotify(pending.previous, pending.current)
		)
			return
		const message = buildTournamentStandingMessage(this.type, pending.previous, pending.current)
		// Transport owns retries. Never replay a potentially delivered chat message.
		void this.send(
			targetedChatMessagePacket(BigInt(id), message, color('#facc15', 'HOST')),
		).catch(() => this.onError())
	}
}

function shouldNotify(
	previous: TournamentPlayerResult | undefined,
	current: TournamentPlayerResult,
) {
	return !previous || previous.rank !== current.rank || current.time < previous.time
}

export function buildTournamentStandingMessage(
	type: TrackTournamentRoomType,
	previous: TournamentPlayerResult | undefined,
	current: TournamentPlayerResult,
) {
	const label = `Track of the ${type === 'weekly' ? 'Week' : 'Month'}`
	const heading = !previous
		? 'First tournament result!'
		: current.time < previous.time
			? 'New personal best!'
			: current.rank < previous.rank
				? 'Rank improved!'
				: 'Rank dropped'
	const rankDelta = previous ? previous.rank - current.rank : 0
	const timeDelta = previous
		? Math.round(current.time * 1000) - Math.round(previous.time * 1000)
		: 0
	const pointsDelta = previous ? current.points - previous.points : 0
	const rank = `#${current.rank}${previous ? (rankDelta === 0 ? ' (unchanged)' : ` (${colorImprovement(`${rankDelta > 0 ? 'up' : 'down'} ${Math.abs(rankDelta)} ${Math.abs(rankDelta) === 1 ? 'position' : 'positions'}`, rankDelta > 0)})`) : ''}`
	const time = `${formatTrackTournamentTime(current.time)}${previous ? (timeDelta === 0 ? ' (unchanged)' : ` (${colorImprovement(`${(Math.abs(timeDelta) / 1000).toFixed(3)}s`, timeDelta < 0)})`) : ''}`
	const points = `${current.points} pts${previous ? (pointsDelta === 0 ? ' (unchanged)' : ` (${colorImprovement(`${pointsDelta > 0 ? '+' : '−'}${Math.abs(pointsDelta)}`, pointsDelta > 0)})`) : ''}`
	return size(
		85,
		color(
			'#dedede',
			`${bold(`${label} — ${heading}`)}${lineBreak()}${rank} · ${time} · ${points}`,
		),
	)
}

function colorImprovement(text: string, improved: boolean) {
	return color(improved ? '#86efac' : '#fca5a5', text)
}
