import { BitReader, BitWriter } from './binary'

export const ZEEPKIST_PACKET_ID = {
	createLobby: packetId('ZeepkistNetworking.CreateLobbyPacket'),
	createLobbyResponse: packetId('ZeepkistNetworking.CreateLobbyResponsePacket'),
	joinLobby: packetId('ZeepkistNetworking.JoinLobbyPacket'),
	joinLobbyResponse: packetId('ZeepkistNetworking.JoinLobbyResponsePacket'),
	initialState: packetId('ZeepkistNetworking.InitialStatePacket'),
	changeLobbyGameProperties: packetId('ZeepkistNetworking.ChangeLobbyGamePropertiesPacket'),
	changeLobbyMaster: packetId('ZeepkistNetworking.ChangeLobbyMasterPacket'),
	changeLobbyPlaylist: packetId('ZeepkistNetworking.ChangeLobbyPlaylistPacket'),
	changeLobbyPlaylistIndex: packetId('ZeepkistNetworking.ChangeLobbyPlaylistIndexPacket'),
	changeLobbyVisibility: packetId('ZeepkistNetworking.ChangeLobbyVisibilityPacket'),
	levelData: packetId('ZeepkistNetworking.LevelDataPacket'),
	levelLoaded: packetId('ZeepkistNetworking.LevelLoadedPacket'),
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

export type MasterRoomResponse =
	| { type: 'create'; result: number; joinId: string }
	| { type: 'join'; result: number; host: string; port: number }

export type GameHostPacket =
	| { type: 'initial'; isHost: boolean }
	| ({ type: 'playlist' } & OnlinePlaylist)
	| {
			type: 'game-properties'
			levelLoadedAt: number
			roundTime: number
			uid: string
			workshopId: bigint
	  }
	| { type: 'master'; uid: number }
	| { type: 'playlist-index'; currentIndex: number; nextIndex: number; selectNext: boolean }
	| {
			data: Uint8Array
			name: string
			type: 'level-data'
			uid: string
			workshopId: bigint
	  }
	| { type: 'level-request'; workshopId: bigint; uid: string }

const MAX_LEVEL_DATA_BYTES = 64 * 1024 * 1024
const MAX_PLAYLIST_LEVELS = 1001

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
		writer.writeBoolean(true)
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

export function levelDataPacket(level: OnlineLevel, compressedData: Uint8Array) {
	return writePacket(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(2)
		writer.writeString(level.name)
		writer.writeString(level.uid)
		writer.writeUInt64(level.workshopId)
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
): GameHostPacket | undefined {
	const reader = new BitReader(payload)
	const id = reader.readUInt16()
	if (id === ZEEPKIST_PACKET_ID.initialState) {
		return { type: 'initial', isHost: readInitialHost(reader, localSteamId) }
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
		return packetType === 3 ? { type: 'level-request', workshopId, uid } : undefined
	}
	return undefined
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

function readInitialHost(reader: BitReader, localSteamId: bigint) {
	const count = reader.readInt32()
	if (count < 0 || count > 256) throw new Error('Invalid initial player count')
	let localIsHost = false
	for (let index = 0; index < count; index++) {
		reader.readUInt32()
		const steamId = reader.readUInt64()
		reader.readString(1024)
		reader.readString(1024)
		const isHost = reader.readBoolean()
		reader.readString(64 * 1024)
		for (let value = 0; value < 3 + 3 + 4; value++) reader.readFloat32()
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
		if (steamId === localSteamId) localIsHost = isHost
	}
	return localIsHost
}

function writePacket(id: number, write: (writer: BitWriter) => void) {
	const writer = new BitWriter()
	writer.writeUInt16(id)
	write(writer)
	return writer.toUint8Array()
}
