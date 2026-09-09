import type { GameHostPacket, GameHostPlayer } from '@zeepkist/core/zeepnet'
import type { PreparedLevel } from '../assets/preparedLevel'
import type { RoomChat } from '../chat/roomChat'
import type { PlayerLeaderboard } from '../leaderboard/playerLeaderboard'

export interface RoomLogger {
	info(message: string): void
	warn(message: string): void
}
export type LevelTransferEvent = {
	type: 'switch' | 'request' | 'uploaded' | 'ready' | 'repeat'
	level: PreparedLevel
}

/** A new context/session is created for every GameServer connection. */
export interface RoomContext {
	activate(level: PreparedLevel): Promise<void>
	chat: RoomChat
	createLeaderboard(onRoster: (ids: bigint[]) => void, onError: () => void): PlayerLeaderboard
	getPlayers(): GameHostPlayer[]
	isHost(): boolean
	isReady(): boolean
	localSteamId: bigint
	logger: RoomLogger
	send(packet: Uint8Array): Promise<void>
	signal: AbortSignal
}

export interface RoomProfileSession {
	onPacket(packet: GameHostPacket): void
	onTransfer(event: LevelTransferEvent): void
	start(): Promise<void>
	stop(): void
}

export interface ManagedLobbyProfile {
	createSession(context: RoomContext): RoomProfileSession
	readonly currentLevel: PreparedLevel | undefined
	readonly name: string
	prepare(): Promise<PreparedLevel | undefined>
	stop(): void
}
