import {
	Zc_DiscordLevelDetailByHashDocument,
	Zc_DiscordLevelSearchDocument,
} from '@zeepkist/graphql/generated'
import type { CommandContext } from '../context'

export async function findLevel(query: string, context: CommandContext) {
	if (/^[1-9][0-9]*$/.test(query)) return context.graphql.levelById(Number(query))
	if (/^[a-f0-9]{16,}$/i.test(query)) {
		const result = await context.graphql.query<Record<string, unknown>>(
			Zc_DiscordLevelDetailByHashDocument,
			{
				xxHash: query,
			},
		)
		return (result as { levelByXxHash?: Record<string, unknown> | null }).levelByXxHash ?? null
	}
	const search = await context.graphql.query<Record<string, unknown>>(
		Zc_DiscordLevelSearchDocument,
		{
			search: query,
		},
	)
	const result = search as { levels?: { nodes: Array<{ xxHash: string }> } }
	const xxHash = result.levels?.nodes[0]?.xxHash
	if (!xxHash) return null
	const detail = await context.graphql.query<Record<string, unknown>>(
		Zc_DiscordLevelDetailByHashDocument,
		{
			xxHash,
		},
	)
	return (detail as { levelByXxHash?: Record<string, unknown> | null }).levelByXxHash ?? null
}
