import type { DiscordBackendClient } from '../../backend'

export function linkedUserOrThrow(state: Awaited<ReturnType<DiscordBackendClient['user']>>) {
	if (!state.linkedUser) {
		throw new Error('Link account first with `/link` or zeepki.st/settings/discord.')
	}
	return state.linkedUser
}
