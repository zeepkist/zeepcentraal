import type { SourceMessage } from '../submissions/reconcile'

export interface ForumThread {
	guild_id: string
	id: string
	name: string
	parent_id: string
	thread_metadata: { locked: boolean; archived: boolean; archive_timestamp: string }
	type: number
}
export class DiscordRest {
	constructor(
		private readonly token: string,
		readonly signal: AbortSignal,
		private readonly transport: (url: string, init: RequestInit) => Promise<Response> = fetch,
	) {}
	async request<T>(path: string, method = 'GET', body?: FormData): Promise<T> {
		for (let attempt = 0; attempt < 5; attempt++) {
			this.signal.throwIfAborted()
			const response = await this.transport(`https://discord.com/api/v10${path}`, {
				method,
				headers: { Authorization: `Bot ${this.token}` },
				body,
				signal: this.signal,
			})
			if (response.status === 429 || response.status >= 500) {
				// Writes are not blindly replayed: a send may have succeeded before a 5xx.
				if (method === 'POST' && response.status !== 429)
					throw new Error('Discord publication outcome uncertain')
				const delay =
					response.status === 429
						? Math.min(
								60_000,
								Math.max(
									1000,
									Number(
										((await response.json()) as { retry_after?: number })
											.retry_after ?? 1,
									) * 1000,
								),
							)
						: 1000 * 2 ** attempt
				await new Promise<void>((resolve) => {
					const done = () => {
						clearTimeout(timer)
						this.signal.removeEventListener('abort', done)
						resolve()
					}
					const timer = setTimeout(done, delay)
					this.signal.addEventListener('abort', done, { once: true })
				})
				continue
			}
			if (!response.ok) throw new Error(`Discord request failed: HTTP ${response.status}`)
			if (response.status === 204) return undefined as T
			return (await response.json()) as T
		}
		throw new Error('Discord retry limit reached')
	}
	async messages(threadId: string) {
		const all: SourceMessage[] = []
		let before = ''
		for (let page = 0; page < 1000; page++) {
			const messages = await this.request<SourceMessage[]>(
				`/channels/${threadId}/messages?limit=100${before ? `&before=${before}` : ''}`,
			)
			if (!messages.length) return all
			all.push(...messages)
			const next = messages.at(-1)!.id
			if (next === before) throw new Error('Discord pagination did not advance')
			before = next
		}
		throw new Error('Discord message page limit reached')
	}
	async discover(guildId: string, forumId: string) {
		const active = await this.request<{ threads: ForumThread[] }>(
			`/guilds/${guildId}/threads/active`,
		)
		const threads = active.threads.filter((t) => t.parent_id === forumId)
		let before = ''
		for (let page = 0; page < 1000; page++) {
			const archived = await this.request<{ threads: ForumThread[]; has_more: boolean }>(
				`/channels/${forumId}/threads/archived/public?limit=100${before ? `&before=${encodeURIComponent(before)}` : ''}`,
			)
			threads.push(...archived.threads)
			if (!archived.has_more) return threads
			const next = archived.threads.at(-1)?.thread_metadata.archive_timestamp
			if (!next || next === before)
				throw new Error('Discord archive pagination did not advance')
			before = next
		}
		throw new Error('Discord archive page limit reached')
	}
	async reaction(threadId: string, message: SourceMessage, valid: boolean | undefined) {
		for (const emoji of ['✅', '❌']) {
			const desired = valid === undefined ? false : valid ? emoji === '✅' : emoji === '❌'
			const current = message.reactions?.some((r) => r.me && r.emoji.name === emoji) ?? false
			if (desired !== current)
				await this.request(
					`/channels/${threadId}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`,
					desired ? 'PUT' : 'DELETE',
				)
		}
	}
}
