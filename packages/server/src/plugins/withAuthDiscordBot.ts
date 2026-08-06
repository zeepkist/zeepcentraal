import { timingSafeEqual } from 'node:crypto'
import { serverConfig } from '@zeepkist/core/config/server'
import type { Elysia } from 'elysia'

function tokenMatches(value: string | null) {
	if (!value?.startsWith('Bearer ')) return false
	const provided = Buffer.from(value.slice(7))
	const expected = Buffer.from(serverConfig.discord.botApiToken)
	return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export const withAuthDiscordBot = (app: Elysia) =>
	app.onBeforeHandle(({ request }) => {
		if (tokenMatches(request.headers.get('authorization'))) return
		return new Response(JSON.stringify({ error: { code: 'invalid_bot_token' } }), {
			status: 401,
			headers: { 'content-type': 'application/json' },
		})
	})
