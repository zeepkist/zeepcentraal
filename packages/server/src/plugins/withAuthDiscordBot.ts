import { timingSafeEqual } from 'node:crypto'
import { serverConfig } from '@zeepkist/core/config/server'
import type { Elysia } from 'elysia'
import { handleProblem } from '../problems'

function tokenMatches(value: string | null) {
	if (!value?.startsWith('Bearer ')) return false
	const provided = Buffer.from(value.slice(7))
	const expected = Buffer.from(serverConfig.discord.botApiToken)
	return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export const withAuthDiscordBot = (app: Elysia) =>
	app.beforeHandle(({ request }) => {
		if (tokenMatches(request.headers.get('authorization'))) return
		return handleProblem(401, 'Not authenticated', 'invalid_bot_token')
	})
