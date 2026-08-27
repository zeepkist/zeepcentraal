import type { DisplayOptions } from '../../display'

export type CursorWindow = {
	after?: string | null
	before?: string | null
	first?: number
	last?: number
}

export type PageInfo = {
	endCursor?: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
	startCursor?: string | null
}

export type PageResult = {
	pageInfo: PageInfo
	rows: string[]
	sections?: DisplayOptions['sections']
	totalCount: number
}

export type PageLoader = (window: CursorWindow, page: number) => Promise<PageResult>

export type PagePresentation = Omit<DisplayOptions, 'footer' | 'sections'> & {
	descriptionPrefix?: string
	emptyDescription?: string
	footer?: string
	sectionHeading?: string
	sections?: DisplayOptions['sections']
}

export type PageSession = {
	expiresAt: number
	loader: PageLoader
	ownerId: string
	page: number
	pageSize: number
	pending?: Promise<void>
	presentation: PagePresentation
	result: PageResult
}

export type PlaylistSession = {
	content: string
	expiresAt: number
	filename: string
	ownerId: string
}

export type CommandSessionStoreOptions = {
	id?: () => string
	cleanupIntervalMs?: number
	maxPageSessions?: number
	maxPlaylistBytes?: number
	maxPlaylistSessions?: number
	now?: () => number
	ttl?: number
}

const DEFAULT_SESSION_TTL = 15 * 60 * 1000
const DEFAULT_CLEANUP_INTERVAL = 60 * 1000

export class CommandSessionStore {
	private readonly id: () => string
	private readonly now: () => number
	private readonly pages = new Map<string, PageSession>()
	private readonly playlists = new Map<string, PlaylistSession>()
	private readonly maxPageSessions: number
	private readonly maxPlaylistBytes: number
	private readonly maxPlaylistSessions: number
	private playlistBytes = 0
	private readonly cleanupTimer: ReturnType<typeof setInterval>
	private readonly ttl: number

	constructor(options: CommandSessionStoreOptions = {}) {
		this.id = options.id ?? (() => crypto.randomUUID())
		this.now = options.now ?? Date.now
		this.ttl = options.ttl ?? DEFAULT_SESSION_TTL
		this.maxPageSessions = Math.max(1, options.maxPageSessions ?? 256)
		this.maxPlaylistSessions = Math.max(1, options.maxPlaylistSessions ?? 64)
		this.maxPlaylistBytes = Math.max(1, options.maxPlaylistBytes ?? 4 * 1024 * 1024)
		this.cleanupTimer = setInterval(
			() => this.cleanup(),
			options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL,
		)
		this.cleanupTimer.unref?.()
	}

	cleanup() {
		const now = this.now()
		for (const [id, session] of this.pages) {
			if (session.expiresAt <= now) this.pages.delete(id)
		}
		for (const [id, session] of this.playlists) {
			if (session.expiresAt <= now) this.deletePlaylist(id, session)
		}
	}

	private deletePlaylist(id: string, session = this.playlists.get(id)) {
		if (!session || !this.playlists.delete(id)) return
		this.playlistBytes -= session.content.length * 2
	}

	private evictOldestPage() {
		const id = this.pages.keys().next().value
		if (id) this.pages.delete(id)
	}

	private evictOldestPlaylist() {
		const id = this.playlists.keys().next().value
		if (id) this.deletePlaylist(id)
	}

	createPages(
		ownerId: string,
		pageSize: number,
		result: PageResult,
		presentation: PagePresentation,
		loader: PageLoader,
	) {
		this.cleanup()
		while (this.pages.size >= this.maxPageSessions) this.evictOldestPage()
		const id = this.id()
		this.pages.set(id, {
			expiresAt: this.now() + this.ttl,
			loader,
			ownerId,
			page: 0,
			pageSize,
			presentation,
			result,
		})
		return { id, session: this.pages.get(id) as PageSession }
	}

	createPlaylist(ownerId: string, filename: string, content: string) {
		this.cleanup()
		const contentBytes = content.length * 2
		if (contentBytes > this.maxPlaylistBytes) throw new Error('Playlist session is too large')
		while (
			this.playlists.size >= this.maxPlaylistSessions ||
			this.playlistBytes + contentBytes > this.maxPlaylistBytes
		) {
			this.evictOldestPlaylist()
		}
		const id = this.id()
		this.playlists.set(id, {
			content,
			expiresAt: this.now() + this.ttl,
			filename,
			ownerId,
		})
		this.playlistBytes += contentBytes
		return id
	}

	page(id: string) {
		return this.pages.get(id)
	}

	playlist(id: string) {
		return this.playlists.get(id)
	}

	stats() {
		return {
			pages: this.pages.size,
			playlistBytes: this.playlistBytes,
			playlists: this.playlists.size,
		}
	}

	[Symbol.dispose]() {
		clearInterval(this.cleanupTimer)
		this.pages.clear()
		this.playlists.clear()
		this.playlistBytes = 0
	}
}
