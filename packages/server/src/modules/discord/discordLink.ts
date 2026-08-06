import { createHmac, randomInt } from 'node:crypto'
import { config } from '@zeepkist/core'

function hashDiscordLinkValue(namespace: 'code' | 'oauth', value: string) {
	return createHmac('sha256', config.jwt.secret)
		.update(`discord-link:${namespace}:${value}`)
		.digest('hex')
}

export function hashDiscordLinkCode(code: string) {
	return hashDiscordLinkValue('code', code)
}

export function hashDiscordOAuthState(state: string) {
	return hashDiscordLinkValue('oauth', state)
}

export function randomDiscordLinkCode() {
	return randomInt(0, 100_000_000).toString().padStart(8, '0')
}
