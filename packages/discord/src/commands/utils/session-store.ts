import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from 'discord.js'

export type Page = {
	components?: APIActionRowComponent<APIButtonComponent>[]
	description: string
	embed?: APIEmbed
	title: string
}

export type PageSession = {
	expiresAt: number
	ownerId: string
	page: number
	pages: Page[]
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

	createPages(ownerId: string, pages: PageSession['pages']) {
		const id = this.id()
		this.pages.set(id, {
			expiresAt: this.now() + this.ttl,
			ownerId,
			page: 0,
			pages,
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
