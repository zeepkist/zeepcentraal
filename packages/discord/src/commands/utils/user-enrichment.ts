import type { LinkedUser } from '../../types'

export function enrichUser(
	user: Record<string, unknown> | null | undefined,
	users: Map<number, LinkedUser>,
) {
	if (!user || typeof user.id !== 'number') return user
	return { ...user, ...users.get(user.id) }
}
