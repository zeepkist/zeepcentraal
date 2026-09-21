import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { Elysia, t } from 'elysia'

const workers = Number(process.env.BENCH_WORKERS ?? '1')

const url = process.env.ZC_PREVIEW_DATABASE_URL
if (url !== 'postgres://zc_preview:local-preview-only@127.0.0.1:5432/zc_rust_sqlx') {
	throw new Error('Benchmark requires its isolated fixture database')
}
export const client = new SQL(url, {
	max: workers === 2 ? 2 : 4,
	idleTimeout: 30,
	connectionTimeout: 5,
})
const db = drizzle(client)
export const app = new Elysia()
	.get('/healthz', () => ({ status: 'ok' }))
	.get('/evaluation/user/:steam', async ({ params }) => {
		const rows = await db.execute(
			sql`SELECT id, steam_id::text AS "steamId", steam_name AS "steamName", banned FROM public."user" WHERE steam_id=${params.steam}::bigint`,
		)
		return rows[0] ?? null
	})
	.get('/evaluation/leaderboard/:level', async ({ params }) => {
		return await db.execute(
			sql`SELECT r.id_user AS "idUser",u.steam_name AS "steamName",min(r.time) AS time FROM public.record r JOIN public."user" u ON u.id=r.id_user WHERE r.id_level=${Number(params.level)} AND NOT u.banned GROUP BY r.id_user,u.steam_name ORDER BY time,r.id_user LIMIT ${100}`,
		)
	})
	.post(
		'/evaluation/record',
		{ body: t.Object({ user: t.Integer(), level: t.Integer(), time: t.Number() }) },
		async ({ body, set }) => {
			if (!Number.isFinite(body.time) || body.time <= 0) {
				set.status = 400
				return { error: 'Invalid time' }
			}
			await db.transaction(async (tx) => {
				const rows = await tx.execute(
					sql`INSERT INTO public.record(id_user,id_level,time) VALUES (${body.user},${body.level},${body.time}) RETURNING id`,
				)
				const id = rows[0]?.id
				if (typeof id !== 'number') throw new Error('Insert missing id')
				await tx.execute(sql`INSERT INTO public.record_audit(id_record) VALUES (${id})`)
			})
			return new Response(null, { status: 204 })
		},
	)
