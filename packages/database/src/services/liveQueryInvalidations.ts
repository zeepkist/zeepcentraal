import { client } from '../client'

type MaxInvalidationRow = {
	id: string
}

export async function getMaxLiveQueryInvalidationId(): Promise<bigint> {
	const rows = await client<MaxInvalidationRow[]>`
		select coalesce(max(id), 0)::text as id
		from public.live_query_invalidations
	`

	return BigInt(rows[0]?.id ?? '0')
}

export async function pruneLiveQueryInvalidations(retentionMinutes: number): Promise<void> {
	await client`
		delete from public.live_query_invalidations
		where created_at < now() - make_interval(mins => ${retentionMinutes})
	`
}
