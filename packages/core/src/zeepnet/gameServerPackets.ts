import { BitReader, BitWriter } from './binary'

export const ZEEPKIST_PACKET_ID = {
	chatMessage: packetId('ZeepkistNetworking.ChatMessagePacket'),
	customChatMessage: packetId('ZeepkistNetworking.CLB_Packet_CustomChatMessage'),
	createLobby: packetId('ZeepkistNetworking.CreateLobbyPacket'),
	createLobbyResponse: packetId('ZeepkistNetworking.CreateLobbyResponsePacket'),
	joinLobby: packetId('ZeepkistNetworking.JoinLobbyPacket'),
	joinLobbyResponse: packetId('ZeepkistNetworking.JoinLobbyResponsePacket'),
	initialState: packetId('ZeepkistNetworking.InitialStatePacket'),
	changeLobbyGameProperties: packetId('ZeepkistNetworking.ChangeLobbyGamePropertiesPacket'),
	changeLobbyGameState: packetId('ZeepkistNetworking.ChangeLobbyGameStatePacket'),
	changeLobbyMaster: packetId('ZeepkistNetworking.ChangeLobbyMasterPacket'),
	changeLobbyPlaylist: packetId('ZeepkistNetworking.ChangeLobbyPlaylistPacket'),
	changeLobbyPlaylistIndex: packetId('ZeepkistNetworking.ChangeLobbyPlaylistIndexPacket'),
	changeLobbyVisibility: packetId('ZeepkistNetworking.ChangeLobbyVisibilityPacket'),
	levelData: packetId('ZeepkistNetworking.LevelDataPacket'),
	levelLoaded: packetId('ZeepkistNetworking.LevelLoadedPacket'),
	playerConnected: packetId('ZeepkistNetworking.PlayerConnectedPacket'),
	playerDisconnected: packetId('ZeepkistNetworking.PlayerDisconnectedPacket'),
	skipToLevel: packetId('ZeepkistNetworking.SkipToLevelPacket'),
} as const

export interface OnlineLevel {
	author: string
	collaborators: string
	name: string
	overrideAuthorName: string
	uid: string
	workshopId: bigint
}

export interface OnlinePlaylistLevel extends OnlineLevel {
	played: boolean
}

export interface OnlinePlaylist {
	currentIndex: number
	isRandom: boolean
	levels: OnlinePlaylistLevel[]
	nextIndex: number
	originalPlaylistLength: number
	roundTime: number
	wasSynced: boolean
}

export interface GameHostPlayer {
	backupName: string
	playerTag: string
	uid: number
	username?: string
}

export type MasterRoomResponse =
	| { type: 'create'; result: number; joinId: string }
	| { type: 'join'; result: number; host: string; port: number }

export type GameHostPacket =
	| { type: 'initial'; isHost: boolean; players: GameHostPlayer[] }
	| { type: 'chat'; message: string; senderUid: number }
	| { type: 'game-state'; state: number }
	| ({ type: 'playlist' } & OnlinePlaylist)
	| {
			type: 'game-properties'
			levelLoadedAt: number
			roundTime: number
			uid: string
			workshopId: bigint
	  }
	| { type: 'master'; uid: number }
	| ({
			type: 'player-connected'
			isHost: boolean
			hasHostPowers: boolean
			steamId: bigint
	  } & GameHostPlayer)
	| { type: 'player-disconnected'; uid: number }
	| { type: 'playlist-index'; currentIndex: number; nextIndex: number; selectNext: boolean }
	| {
			data: Uint8Array
			name: string
			type: 'level-data'
			uid: string
			workshopId: bigint
	  }
	| { type: 'level-request'; name: string; workshopId: bigint; uid: string }

const MAX_LEVEL_DATA_BYTES = 64 * 1024 * 1024
const MAX_PLAYLIST_LEVELS = 1001
const MAX_CHAT_MESSAGE_BYTES = 4096
const MAX_CHAT_BADGES = 64
const MAX_CHAT_BADGE_BYTES = 1024
const MAX_PLAYERS = 256

export function packetId(fullName: string) {
	let hash = 23
	for (const character of fullName) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0
	return hash & 0xffff
}

export function createLobbyPacket(input: {
	isPublic: boolean
	maxPlayers: number
	name: string
	originalHostName: string
}) {
	return writePacket(ZEEPKIST_PACKET_ID.createLobby, (writer) => {
		writer.writeInt32(input.maxPlayers)
		writer.writeString(input.name)
		writer.writeBoolean(input.isPublic)
		writer.writeString(input.originalHostName)
	})
}

export function joinLobbyPacket(joinId: string) {
	return writePacket(ZEEPKIST_PACKET_ID.joinLobby, (writer) => writer.writeString(joinId))
}

export function changeLobbyVisibilityPacket(isPublic: boolean) {
	return writePacket(ZEEPKIST_PACKET_ID.changeLobbyVisibility, (writer) =>
		writer.writeBoolean(isPublic),
	)
}

export function chatMessagePacket(message: string) {
	const byteLength = new TextEncoder().encode(message).byteLength
	if (byteLength < 1 || byteLength > MAX_CHAT_MESSAGE_BYTES) {
		throw new Error(`Chat message must contain between 1 and ${MAX_CHAT_MESSAGE_BYTES} bytes`)
	}
	return writePacket(ZEEPKIST_PACKET_ID.chatMessage, (writer) => {
		writer.writeUInt32(0)
		writer.writeString(message)
		writer.writeInt32(0)
	})
}

export function targetedChatMessagePacket(
	targetSteamId: bigint,
	message: string,
	hostname: string,
) {
	if (targetSteamId <= 0n || targetSteamId > 0xffff_ffff_ffff_ffffn) {
		throw new Error('Target Steam ID must be between 1 and 18446744073709551615')
	}
	validateChatString(message, 'Chat message')
	validateChatString(hostname, 'Chat hostname')
	return writePacket(ZEEPKIST_PACKET_ID.customChatMessage, (writer) => {
		writer.writeUInt64(targetSteamId)
		writer.writeString(message)
		writer.writeString(hostname)
	})
}

export function changeLobbyPlaylistPacket(level: OnlineLevel, roundTimeSeconds: number) {
	return writePacket(ZEEPKIST_PACKET_ID.changeLobbyPlaylist, (writer) => {
		writer.writeFloat64(roundTimeSeconds)
		writer.writeBoolean(false)
		writer.writeInt32(0)
		writer.writeInt32(0)
		writer.writeInt32(1)
		writer.writeString(level.uid)
		writer.writeUInt64(level.workshopId)
		writer.writeString(level.name)
		writer.writeString(level.collaborators)
		writer.writeString(level.overrideAuthorName)
		writer.writeString(level.author)
		writer.writeBoolean(false)
		writer.writeBoolean(true)
		writer.writeInt32(1)
	})
}

export function skipToLevelPacket(level: OnlineLevel) {
	return writePacket(ZEEPKIST_PACKET_ID.skipToLevel, (writer) => {
		writer.writeString(level.uid)
		writer.writeUInt64(level.workshopId)
	})
}

export function levelDataPacket(
	request: { name: string; uid: string; workshopId: bigint },
	compressedData: Uint8Array,
) {
	return writePacket(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(2)
		writer.writeString(request.name)
		writer.writeString(request.uid)
		writer.writeUInt64(request.workshopId)
		writer.writeInt32(compressedData.length)
		writer.writeBytes(compressedData)
	})
}

export function levelDataRequestPacket() {
	return writePacket(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(0)
		writer.writeString('')
		writer.writeString('')
		writer.writeUInt64(0n)
		writer.writeInt32(0)
	})
}

export function levelLoadedPacket() {
	return writePacket(ZEEPKIST_PACKET_ID.levelLoaded, () => {})
}

export function parseMasterRoomResponse(payload: Uint8Array): MasterRoomResponse | undefined {
	const reader = new BitReader(payload)
	const id = reader.readUInt16()
	if (id === ZEEPKIST_PACKET_ID.createLobbyResponse) {
		return { type: 'create', result: reader.readUInt16(), joinId: reader.readString(1024) }
	}
	if (id === ZEEPKIST_PACKET_ID.joinLobbyResponse) {
		return {
			type: 'join',
			result: reader.readUInt16(),
			host: reader.readString(1024),
			port: reader.readInt32(),
		}
	}
	return undefined
}

export function parseGameHostPacket(
	payload: Uint8Array,
	localSteamId: bigint,
	localPlayerUid?: number,
): GameHostPacket | undefined {
	const reader = new BitReader(payload)
	const id = reader.readUInt16()
	if (id === ZEEPKIST_PACKET_ID.initialState) {
		const initial = readInitialPlayers(reader, localSteamId, localPlayerUid)
		return { type: 'initial', ...initial }
	}
	if (id === ZEEPKIST_PACKET_ID.chatMessage) {
		const senderUid = reader.readUInt32()
		const message = reader.readString(MAX_CHAT_MESSAGE_BYTES)
		const badgeCount = reader.readInt32()
		if (badgeCount < 0 || badgeCount > MAX_CHAT_BADGES)
			throw new Error('Invalid chat badge count')
		for (let index = 0; index < badgeCount; index++) reader.readString(MAX_CHAT_BADGE_BYTES)
		return { type: 'chat', message, senderUid }
	}
	if (id === ZEEPKIST_PACKET_ID.playerConnected) {
		const uid = reader.readUInt32()
		const steamId = reader.readUInt64()
		const isHost = reader.readBoolean()
		const hasHostPowers = reader.readBoolean()
		return {
			type: 'player-connected',
			uid,
			steamId,
			isHost,
			hasHostPowers,
			playerTag: reader.readString(1024),
			backupName: reader.readString(1024),
			username: reader.readString(1024),
		}
	}
	if (id === ZEEPKIST_PACKET_ID.playerDisconnected) {
		return { type: 'player-disconnected', uid: reader.readUInt32() }
	}
	if (id === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
		return { type: 'playlist', ...readPlaylist(reader) }
	}
	if (id === ZEEPKIST_PACKET_ID.changeLobbyGameProperties) {
		return {
			type: 'game-properties',
			roundTime: reader.readFloat64(),
			levelLoadedAt: reader.readFloat64(),
			uid: reader.readString(4096),
			workshopId: reader.readUInt64(),
		}
	}
	if (id === ZEEPKIST_PACKET_ID.changeLobbyGameState) {
		return { type: 'game-state', state: reader.readInt32() }
	}
	if (id === ZEEPKIST_PACKET_ID.changeLobbyMaster) {
		return { type: 'master', uid: reader.readUInt32() }
	}
	if (id === ZEEPKIST_PACKET_ID.changeLobbyPlaylistIndex) {
		return {
			type: 'playlist-index',
			currentIndex: reader.readInt32(),
			nextIndex: reader.readInt32(),
			selectNext: reader.readBoolean(),
		}
	}
	if (id === ZEEPKIST_PACKET_ID.levelData) {
		const packetType = reader.readInt32()
		const name = reader.readString(4096)
		const uid = reader.readString(4096)
		const workshopId = reader.readUInt64()
		const byteLength = reader.readInt32()
		if (
			byteLength < 0 ||
			byteLength > MAX_LEVEL_DATA_BYTES ||
			byteLength * 8 > reader.remainingBits
		)
			throw new Error('Invalid level payload')
		const data = reader.readBytes(byteLength)
		if (packetType === 1) return { type: 'level-data', data, name, uid, workshopId }
		return packetType === 3 ? { type: 'level-request', name, workshopId, uid } : undefined
	}
	return undefined
}

function validateChatString(value: string, label: string) {
	const byteLength = new TextEncoder().encode(value).byteLength
	if (byteLength < 1 || byteLength > MAX_CHAT_MESSAGE_BYTES) {
		throw new Error(`${label} must contain between 1 and ${MAX_CHAT_MESSAGE_BYTES} bytes`)
	}
}

function readPlaylist(reader: BitReader): OnlinePlaylist {
	const roundTime = reader.readFloat64()
	const isRandom = reader.readBoolean()
	const currentIndex = reader.readInt32()
	const nextIndex = reader.readInt32()
	const count = reader.readInt32()
	if (count < 0 || count > MAX_PLAYLIST_LEVELS) throw new Error('Invalid playlist length')
	const levels: OnlinePlaylistLevel[] = []
	for (let index = 0; index < count; index++) {
		levels.push({
			uid: reader.readString(4096),
			workshopId: reader.readUInt64(),
			name: reader.readString(4096),
			collaborators: reader.readString(4096),
			overrideAuthorName: reader.readString(4096),
			author: reader.readString(4096),
			played: reader.readBoolean(),
		})
	}
	const wasSynced = reader.readBoolean()
	const originalPlaylistLength = reader.readInt32()
	return {
		currentIndex,
		isRandom,
		levels,
		nextIndex,
		originalPlaylistLength,
		roundTime,
		wasSynced,
	}
}

function readInitialPlayers(reader: BitReader, localSteamId: bigint, localPlayerUid?: number) {
	const count = reader.readInt32()
	if (count < 0 || count > MAX_PLAYERS) throw new Error('Invalid initial player count')
	let localIsHost = false
	const players: GameHostPlayer[] = []
	for (let index = 0; index < count; index++) {
		const playerUid = reader.readUInt32()
		const steamId = reader.readUInt64()
		const playerTag = reader.readString(1024)
		const backupName = reader.readString(1024)
		const isHost = reader.readBoolean()
		players.push({ uid: playerUid, playerTag, backupName })
		reader.readString(64 * 1024)
		for (let value = 0; value < 3 + 4; value++) reader.readFloat32()
		reader.readBoolean()
		reader.readBoolean()
		reader.readByte()
		for (let value = 0; value < 13; value++) reader.readBoolean()
		reader.readInt32()
		reader.readInt32()
		if (reader.readBoolean()) {
			reader.readString(4096)
			reader.readInt32()
			reader.readFloat32()
		}
		if (
			localPlayerUid === undefined ? steamId === localSteamId : playerUid === localPlayerUid
		) {
			localIsHost = isHost
		}
	}
	return { isHost: localIsHost, players }
}

function writePacket(id: number, write: (writer: BitWriter) => void) {
	const writer = new BitWriter()
	writer.writeUInt16(id)
	write(writer)
	return writer.toUint8Array()
}
