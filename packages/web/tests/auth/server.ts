import { SQL } from 'bun'

const databaseUrl = process.env.WEB_AUTH_TEST_DATABASE_URL
if (
	!databaseUrl ||
	new URL(databaseUrl).hostname !== '127.0.0.1' ||
	new URL(databaseUrl).pathname !== '/auth_fixture'
) {
	throw new Error('Auth fixture requires isolated local auth_fixture database')
}
const sql = new SQL(databaseUrl)
for (let attempt = 0; ; attempt++) {
	try {
		await sql`SELECT 1`
		break
	} catch (error) {
		if (attempt === 60) throw error
		await Bun.sleep(250)
	}
}
await sql`CREATE TABLE public."user" (
	id integer PRIMARY KEY, steam_id bigint, steam_name text, discord_id bigint,
	role text NOT NULL, banned boolean NOT NULL DEFAULT false
)`
await sql`CREATE TABLE public.auth (
	id serial PRIMARY KEY, id_user integer NOT NULL REFERENCES public."user"(id),
	access_token text, access_token_expiry bigint,
	refresh_token_hash text UNIQUE, refresh_token_expiry bigint
)`
const steamId = '76561198000000000'
let attempts = 0
let rotations = 0
let failRefresh = false
let delayRefresh = 0
function hash(token: string) {
	return new Bun.CryptoHasher('sha256').update(token).digest('hex')
}
function pair(ttl = 900) {
	const expires = Math.floor(Date.now() / 1000) + ttl
	return {
		access: `fixture.${Buffer.from(JSON.stringify({ exp: expires })).toString('base64url')}.${crypto.randomUUID()}`,
		refresh: crypto.randomUUID(),
		expires,
	}
}
function cookies(tokens: ReturnType<typeof pair>, includeAccess = true) {
	return [
		...(includeAccess
			? [
					`zeepcentral_access_token=${tokens.access}; Path=/; Max-Age=900; HttpOnly; SameSite=Lax`,
				]
			: []),
		`zeepcentral_refresh_token=${tokens.refresh}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`,
		`zeepcentral_steam_id=${steamId}; Path=/; Max-Age=604800; SameSite=Lax`,
	]
}
function response(tokens: ReturnType<typeof pair>, includeAccess = true) {
	const headers = new Headers({ 'cache-control': 'no-store' })
	for (const cookie of cookies(tokens, includeAccess)) headers.append('set-cookie', cookie)
	return Response.json({ access: tokens.access, refresh: tokens.refresh }, { headers })
}
Bun.serve({
	hostname: '127.0.0.1',
	port: 4199,
	async fetch(request) {
		const url = new URL(request.url)
		if (url.pathname === '/healthz') return new Response('OK')
		if (url.pathname === '/__test/seed') {
			const options = (await request.json()) as {
				ttl?: number
				missing?: boolean
				invalid?: string
				fail?: boolean
				delay?: number
			}
			await sql`TRUNCATE public.auth, public."user" RESTART IDENTITY`
			await sql`INSERT INTO public."user" VALUES (1, ${steamId}, 'Auth fixture', NULL, 'admin', ${options.invalid === 'banned'})`
			const tokens = pair(options.ttl)
			await sql`INSERT INTO public.auth(id_user,access_token,access_token_expiry,refresh_token_hash,refresh_token_expiry)
				VALUES (1, ${tokens.access}, ${tokens.expires}, ${hash(tokens.refresh)}, ${Math.floor(Date.now() / 1000) + (options.invalid === 'expired' ? -1 : 604800)})`
			if (options.invalid === 'revoked') await sql`DELETE FROM public.auth`
			if (options.invalid === 'mismatched') tokens.refresh = crypto.randomUUID()
			attempts = 0
			rotations = 0
			failRefresh = options.fail ?? false
			delayRefresh = options.delay ?? 0
			return response(tokens, !options.missing)
		}
		if (url.pathname === '/__test/state') return Response.json({ attempts, rotations })
		if (url.pathname === '/auth/web/refresh') {
			attempts++
			if (delayRefresh) await Bun.sleep(delayRefresh)
			if (failRefresh) return new Response(null, { status: 503 })
			const incoming = new Map(
				(request.headers.get('cookie') ?? '').split(';').map((entry) => {
					const index = entry.indexOf('=')
					return [entry.slice(0, index).trim(), entry.slice(index + 1)]
				}),
			)
			const tokens = pair()
			const rotated = await sql.begin(async (tx) => {
				const deleted =
					await tx`DELETE FROM public.auth a USING public."user" u WHERE a.id_user=u.id
					AND u.steam_id=${incoming.get('zeepcentral_steam_id') ?? '0'} AND NOT u.banned
					AND a.refresh_token_hash=${hash(incoming.get('zeepcentral_refresh_token') ?? '')}
					AND a.refresh_token_expiry>extract(epoch FROM clock_timestamp()) RETURNING a.id`
				if (!deleted.length) return false
				await tx`INSERT INTO public.auth(id_user,access_token,access_token_expiry,refresh_token_hash,refresh_token_expiry)
					VALUES (1, ${tokens.access}, ${tokens.expires}, ${hash(tokens.refresh)}, ${Math.floor(Date.now() / 1000) + 604800})`
				return true
			})
			if (!rotated) return new Response(null, { status: 401 })
			rotations++
			return response(tokens)
		}
		return fetch(new URL(url.pathname + url.search, 'http://127.0.0.1:4198'), request)
	},
})
