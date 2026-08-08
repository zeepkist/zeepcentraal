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
	now?: () => number
	ttl?: number
}

const DEFAULT_SESSION_TTL = 15 * 60 * 1000

export class CommandSessionStore {
	private readonly id: () => string
	private readonly now: () => number
	private readonly pages = new Map<string, PageSession>()
	private readonly playlists = new Map<string, PlaylistSession>()
	private readonly ttl: number

	constructor(options: CommandSessionStoreOptions = {}) {
		this.id = options.id ?? (() => crypto.randomUUID())
		this.now = options.now ?? Date.now
		this.ttl = options.ttl ?? DEFAULT_SESSION_TTL
	}

	cleanup() {
		const now = this.now()
		for (const [id, session] of this.pages) {
			if (session.expiresAt <= now) this.pages.delete(id)
		}
		for (const [id, session] of this.playlists) {
			if (session.expiresAt <= now) this.playlists.delete(id)
		}
	}

	createPages(
		ownerId: string,
		pageSize: number,
		result: PageResult,
		presentation: PagePresentation,
		loader: PageLoader,
	) {
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
		const id = this.id()
		this.playlists.set(id, {
			content,
			expiresAt: this.now() + this.ttl,
			filename,
			ownerId,
		})
		return id
	}

	page(id: string) {
		return this.pages.get(id)
	}

	playlist(id: string) {
		return this.playlists.get(id)
	}
}
