import { backendErrorDetail, DiscordBackendError } from './errors'
import type {
	DiscordBotConfig,
	DiscordFeedKind,
	DiscordGuildState,
	DiscordUserState,
} from './types'

type FetchInput = Omit<RequestInit, 'body'> & { body?: unknown }

export class DiscordBackendClient {
	constructor(
		private readonly config: DiscordBotConfig,
		private readonly fetchImpl: typeof fetch = fetch,
	) {}

	private async request<T>(path: string, input: FetchInput = {}): Promise<T> {
		const method = (input.method ?? 'GET').toUpperCase()
		const response = await this.fetchImpl(new URL(path, this.config.backendUrl), {
			...input,
			headers: {
				authorization: `Bearer ${this.config.apiToken}`,
				'content-type': 'application/json',
				...input.headers,
			},
			body: input.body === undefined ? undefined : JSON.stringify(input.body),
		})
		if (!response.ok) {
			throw new DiscordBackendError(
				response.status,
				method,
				path,
				response.headers.get('retry-after'),
				await backendErrorDetail(response),
			)
		}
		return (await response.json()) as T
	}

	user(discordId: string) {
		return this.request<DiscordUserState>(`/discord-bot/users/${discordId}`)
	}

	redeem(code: string, discordId: string) {
		return this.request<{ status: string; idUser?: number }>('/discord-bot/link/redeem', {
			method: 'POST',
			body: { code, discordId },
		})
	}

	unlink(discordId: string) {
		return this.request<{ idUser?: number }>(`/discord-bot/users/${discordId}/link`, {
			method: 'DELETE',
		})
	}

	setPreference(discordId: string, pingOnWorldRecordLoss: boolean) {
		return this.request(`/discord-bot/users/${discordId}/preferences`, {
			method: 'PATCH',
			body: { pingOnWorldRecordLoss },
		})
	}

	addWatch(discordId: string, kind: string, targetId: string) {
		return this.request(`/discord-bot/users/${discordId}/watches`, {
			method: 'POST',
			body: { kind, targetId },
		})
	}

	removeWatch(discordId: string, watchId: string) {
		return this.request(`/discord-bot/users/${discordId}/watches/${watchId}`, {
			method: 'DELETE',
		})
	}

	matchingWatches(
		targets: Array<{
			kind: 'player' | 'level' | 'author' | 'tournament'
			targetIds: string[]
		}>,
	) {
		return this.request<
			Array<{
				id: string
				discordId: string
				kind: string
				targetId: string
				lastDeliveryKey: string | null
			}>
		>('/discord-bot/watches/matches', { method: 'POST', body: { targets } })
	}

	updateWatchDelivery(
		watchId: string,
		input: { paused: boolean; lastError: string | null; deliveryKey: string | null },
	) {
		return this.request(`/discord-bot/watches/${watchId}/delivery`, {
			method: 'PATCH',
			body: input,
		})
	}

	async workerCursor(key: string) {
		return this.request<{ cursorEventId: string }>(`/discord-bot/workers/${key}/cursor`)
	}

	advanceWorkerCursor(key: string, eventId: string) {
		return this.request(`/discord-bot/workers/${key}/cursor`, {
			method: 'POST',
			body: { eventId },
		})
	}

	guild(guildId: string) {
		return this.request<DiscordGuildState>(`/discord-bot/guilds/${guildId}`)
	}

	setFeed(guildId: string, kind: DiscordFeedKind, channelId: string, enabled: boolean) {
		return this.request(`/discord-bot/guilds/${guildId}/feeds/${kind}`, {
			method: 'PUT',
			body: { channelId, enabled },
		})
	}

	setLinkedRole(guildId: string, roleId: string | null) {
		return this.request(`/discord-bot/guilds/${guildId}/linked-role`, {
			method: 'PUT',
			body: { roleId },
		})
	}

	advanceFeed(guildId: string, kind: DiscordFeedKind, eventId: string) {
		return this.request(`/discord-bot/guilds/${guildId}/feeds/${kind}/cursor`, {
			method: 'POST',
			body: { eventId },
		})
	}

	setDelivery(input: {
		guildId: string
		eventId: string
		channelId: string
		messageId: string | null
		status: 'pending' | 'sent' | 'failed'
		lastError?: string | null
	}) {
		return this.request(`/discord-bot/guilds/${input.guildId}/deliveries/${input.eventId}`, {
			method: 'PUT',
			body: {
				channelId: input.channelId,
				messageId: input.messageId,
				status: input.status,
				lastError: input.lastError,
			},
		})
	}

	delivery(guildId: string, eventId: string) {
		return this.request<{
			status: 'pending' | 'sent' | 'failed'
			messageId: string | null
		} | null>(`/discord-bot/guilds/${guildId}/deliveries/${eventId}`)
	}

	setTournamentMessage(input: {
		guildId: string
		tournamentId: number
		channelId: string
		messageId: string
		contentHash: string
	}) {
		return this.request(
			`/discord-bot/guilds/${input.guildId}/tournaments/${input.tournamentId}/message`,
			{ method: 'PUT', body: input },
		)
	}
}
