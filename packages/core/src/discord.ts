import { config } from './config'

const DISCORD_API_BASE_URL = 'https://discord.com/api'
const DISCORD_AUTHORIZE_URL = `${DISCORD_API_BASE_URL}/oauth2/authorize`
const DISCORD_TOKEN_URL = `${DISCORD_API_BASE_URL}/oauth2/token`
const DISCORD_USER_URL = `${DISCORD_API_BASE_URL}/users/@me`

export function getDiscordRedirectUrl(state?: string) {
	const redirectUri = config.discord.redirectUri ?? `${config.backendUrl}/auth/discord/callback`
	const params = new URLSearchParams({
		client_id: config.discord.clientId ?? '',
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'identify',
	})
	if (state) {
		params.set('state', state)
	}

	return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`
}

export async function getDiscordAccessToken(code: string) {
	if (!config.discord.clientId || !config.discord.clientSecret) {
		return null
	}

	const response = await fetch(DISCORD_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: config.discord.clientId,
			client_secret: config.discord.clientSecret,
			grant_type: 'authorization_code',
			code,
			redirect_uri:
				config.discord.redirectUri ?? `${config.backendUrl}/auth/discord/callback`,
		}),
	})

	if (!response.ok) {
		return null
	}

	const data = (await response.json()) as { access_token?: string }
	return data.access_token ?? null
}

export async function getDiscordUser(accessToken: string) {
	const response = await fetch(DISCORD_USER_URL, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})

	if (!response.ok) {
		return null
	}

	return (await response.json()) as { id: string }
}
