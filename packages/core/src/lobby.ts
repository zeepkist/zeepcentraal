export type LobbyFeedStatus = 'connecting' | 'live' | 'stale' | 'unavailable'

export interface LobbyListing {
	host: {
		name: string
		steamId: string
	}
	isPublic: boolean
	playerLimit: number
	players: number
	title: string
}

export interface LobbySnapshot {
	lobbies: LobbyListing[]
	staleSince: string | null
	stats: {
		onlinePlayers: number | null
		lobbyCount: number | null
		playersInLobbies: number | null
	}
	status: LobbyFeedStatus
	updatedAt: string | null
}
