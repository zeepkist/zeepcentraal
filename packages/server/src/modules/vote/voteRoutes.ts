import { getLevelByXxHash, getUser, upsertVote } from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { withAuthRequest } from '../../plugins/withAuth'
import { withRateLimit } from '../../plugins/withRateLimit'

export const voteRoutes = new Elysia({ prefix: '/vote' })
	.use(withAuthRequest)
	.use(withRateLimit('mutation'))
	.post(
		'/submit',
		async ({ auth, body, set }) => {
			const { Hash, Value } = body
			const validHash = typeof Hash === 'string' && /^[0-9A-F]{32}$/.test(Hash)

			if (!validHash || Value === undefined) {
				set.status = 400
				return {
					error: {
						code: 17,
						message: 'Missing required parameters',
					},
				}
			}

			const user = await getUser(auth.steamId)
			if (!user || user.banned) {
				set.status = 401
				return {
					error: {
						code: 16,
						message: 'User not found',
					},
				}
			}

			const level = await getLevelByXxHash(Hash)
			if (!level) {
				set.status = 400
				return {
					error: {
						code: 18,
						message: 'Level not found',
					},
				}
			}

			await upsertVote(user.id, level.id, Value)

			set.status = 200
			return
		},
		{
			body: t.Object({
				Hash: t.String(),
				Value: t.Union([
					t.Literal(-2),
					t.Literal(-1),
					t.Literal(0),
					t.Literal(1),
					t.Literal(2),
				]),
			}),
		},
	)
