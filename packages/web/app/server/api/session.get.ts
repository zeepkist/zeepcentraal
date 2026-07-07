import type { SessionUser } from '../../types/app'
import { fetchBackendUser } from '../utils/backend'

export default defineEventHandler(async (event) => {
	try {
		const user = (await fetchBackendUser(event)) as {
			Id?: number
			SteamId?: string
			SteamName?: string
			DiscordId?: string | null
			id?: number
			steamId?: string
			steamName?: string
			discordId?: string | null
		}

		const normalized: SessionUser = {
			id: user.id ?? user.Id ?? 0,
			steamId: user.steamId ?? user.SteamId ?? '',
			steamName: user.steamName ?? user.SteamName,
			discordId: user.discordId ?? user.DiscordId ?? null,
		}

		return { user: normalized }
	} catch {
		return { user: null }
	}
})
