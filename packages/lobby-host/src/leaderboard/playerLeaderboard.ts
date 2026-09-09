import {
	type GameHostPacket,
	type GameHostPlayer,
	type LeaderboardOverrides,
	playerLeaderboardOverridesPacket,
	playerLeaderboardTimePacket,
} from '@zeepkist/core/zeepnet'

export interface DesiredPlayerStanding {
	overrides: LeaderboardOverrides
	steamId: string
	time?: number
}

const EMPTY: LeaderboardOverrides = { time: '', position: '', name: '', points: '', pointsWon: '' }

/** Room-local projection. Steam identities remain internal and never enter telemetry. */
export class PlayerLeaderboard {
	private roster = new Map<number, GameHostPlayer>()
	private results = new Map<string, DesiredPlayerStanding>()
	private times = new Map<bigint, number>()
	private overrides = new Map<bigint, LeaderboardOverrides>()
	private clearing = new Set<bigint>()
	private revision = 0
	private timer?: ReturnType<typeof setTimeout>
	private running = false
	private dirty = false
	private ready = false
	private closed = false
	private scopeId?: string
	private levelUid?: string

	constructor(
		private readonly send: (packet: Uint8Array) => Promise<void>,
		private readonly onRoster: (ids: bigint[]) => void,
		private readonly onError: () => void,
		private readonly localSteamId: bigint,
	) {}

	setScope(scopeId: string, levelUid: string) {
		if (this.scopeId !== scopeId) {
			for (const id of this.overrides.keys()) this.clearing.add(id)
			this.results.clear()
			this.times.clear()
			this.overrides.clear()
			this.scopeId = scopeId
			this.revision++
		}
		this.levelUid = levelUid
		this.schedule()
	}

	setReady(ready: boolean) {
		this.ready = ready
		this.revision++
		if (ready) this.schedule()
	}

	setRoster(players: GameHostPlayer[]) {
		this.roster = new Map(
			players
				.filter((p) => p.steamId > 0n && p.steamId !== this.localSteamId)
				.slice(0, 64)
				.map((p) => [p.uid, p]),
		)
		this.rosterChanged()
	}

	refreshRoster() {
		this.onRoster([...this.roster.values()].map((player) => player.steamId))
	}

	private rosterChanged() {
		this.revision++
		const ids = new Set([...this.roster.values()].map((p) => p.steamId))
		for (const id of this.times.keys()) if (!ids.has(id)) this.times.delete(id)
		for (const id of this.overrides.keys()) if (!ids.has(id)) this.overrides.delete(id)
		for (const id of this.clearing) if (!ids.has(id)) this.clearing.delete(id)
		for (const id of this.results.keys()) if (!ids.has(BigInt(id))) this.results.delete(id)
		this.onRoster([...ids])
		this.schedule()
	}

	setDesired(results: DesiredPlayerStanding[]) {
		this.results = new Map(results.map((result) => [result.steamId, result]))
		this.revision++
		this.schedule()
	}

	getPlayers() {
		return [...this.roster.values()]
	}

	observe(packet: GameHostPacket) {
		if (this.closed) return
		if (packet.type === 'initial') this.setRoster(packet.players)
		if (
			packet.type === 'player-connected' &&
			packet.steamId !== this.localSteamId &&
			packet.steamId > 0n &&
			(this.roster.has(packet.uid) || this.roster.size < 64)
		) {
			this.roster.set(packet.uid, packet)
			this.rosterChanged()
		}
		if (packet.type === 'player-disconnected') {
			this.roster.delete(packet.uid)
			this.rosterChanged()
		}
		if (packet.type === 'leaderboard') {
			if (packet.packetType === 0 || packet.packetType === 1) {
				this.times = new Map(packet.times.map((p) => [p.steamId, p.time]))
			}
			if (packet.packetType === 0 || packet.packetType === 2) {
				this.overrides = new Map(packet.overrides.map((p) => [p.steamId, p]))
			}
			this.schedule()
		}
		if (
			packet.type === 'player-result' &&
			(!packet.hasResult || packet.levelUid === this.levelUid)
		) {
			const player = this.roster.get(packet.uid)
			if (player) {
				if (packet.hasResult) this.times.set(player.steamId, packet.time)
				else this.times.delete(player.steamId)
				this.schedule()
			}
		}
	}

	close() {
		this.closed = true
		this.revision++
		if (this.timer) clearTimeout(this.timer)
		this.roster.clear()
		this.results.clear()
		this.times.clear()
		this.overrides.clear()
		this.clearing.clear()
	}

	private schedule(delay = 25) {
		this.dirty = true
		if (this.closed || !this.ready || this.running || this.timer) return
		this.timer = setTimeout(() => {
			this.timer = undefined
			void this.flush()
		}, delay)
	}

	private async flush() {
		if (this.closed || !this.ready) return
		this.running = true
		this.dirty = false
		const revision = this.revision
		const valid = () => !this.closed && this.ready && revision === this.revision
		let failed = false
		try {
			for (const player of this.roster.values()) {
				if (!valid()) break
				const id = player.steamId
				if (this.clearing.has(id)) {
					this.clearing.delete(id)
					await this.send(playerLeaderboardOverridesPacket(id, EMPTY))
					if (!valid()) break
				}
				const result = this.results.get(id.toString())
				if (!result) continue
				if (result.time !== undefined) {
					const time = Math.fround(Math.min(result.time, 36000))
					if (this.times.get(id) !== time) {
						this.times.set(id, time)
						await this.send(playerLeaderboardTimePacket(id, result.time))
						if (!valid()) break
					}
				}
				const desired = result.overrides
				if (!sameOverrides(this.overrides.get(id), desired)) {
					this.overrides.set(id, desired)
					await this.send(playerLeaderboardOverridesPacket(id, desired))
				}
			}
		} catch {
			failed = true
			this.times.clear()
			this.overrides.clear()
			this.onError()
		} finally {
			this.running = false
			if (failed || this.dirty || revision !== this.revision)
				this.schedule(failed ? 5_000 : 25)
		}
	}
}

function sameOverrides(a: LeaderboardOverrides | undefined, b: LeaderboardOverrides) {
	return (
		a !== undefined &&
		a.time === b.time &&
		a.name === b.name &&
		a.position === b.position &&
		a.points === b.points &&
		a.pointsWon === b.pointsWon
	)
}
