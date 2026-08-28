import {
	addFavourite,
	getLevelByXxHash,
	getUser,
	removeFavourite,
} from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { OPENAPI_TAG, PROBLEM_DETAILS_SCHEMA, USER_SECURITY } from '../../openapi'
import { withAuthRequest } from '../../plugins/withAuth'
import { withRateLimit } from '../../plugins/withRateLimit'
import { ERROR_CODES, handleProblem } from '../../problems'

const favouriteBody = t.Object(
	{
		hash: t.String({
			description: 'Uppercase 32-character XXH128 level hash.',
			pattern: '^[0-9A-F]{32}$',
		}),
	},
	{ additionalProperties: t.Never() },
)

const responses = {
	200: { description: 'Favourite state updated successfully; response body is empty.' },
	400: {
		description: 'Authentication is missing or the requested level does not exist.',
		content: { 'application/problem+json': { schema: PROBLEM_DETAILS_SCHEMA } },
	},
	401: {
		description: 'Authentication is invalid or the authenticated user is unavailable.',
		content: { 'application/problem+json': { schema: PROBLEM_DETAILS_SCHEMA } },
	},
}

export const favouriteRoutes = new Elysia({ prefix: '/favourite' })
	.use(withAuthRequest)
	.use(withRateLimit('mutation'))
	.post(
		'/add',
		{
			body: favouriteBody,
			detail: {
				operationId: 'addFavourite',
				summary: 'Add a favourite level',
				description:
					'Adds the canonical level to the authenticated user’s favourites when not already present.',
				security: USER_SECURITY,
				tags: [OPENAPI_TAG.favourite],
				responses,
			},
		},
		async ({ auth, body, set }) => {
			const user = await getUser(auth.steamId)
			if (!user || user.banned) {
				return handleProblem(401, ERROR_CODES.AUTH_USER_NOT_FOUND)
			}

			const level = await getLevelByXxHash(body.hash)
			if (!level) {
				return handleProblem(400, ERROR_CODES.LEVEL_NOT_FOUND)
			}

			await addFavourite(user.id, level.id)
			set.status = 200
		},
	)
	.post(
		'/remove',
		{
			body: favouriteBody,
			detail: {
				operationId: 'removeFavourite',
				summary: 'Remove a favourite level',
				description:
					'Removes the canonical level from the authenticated user’s favourites when present.',
				security: USER_SECURITY,
				tags: [OPENAPI_TAG.favourite],
				responses,
			},
		},
		async ({ auth, body, set }) => {
			const user = await getUser(auth.steamId)
			if (!user || user.banned) {
				return handleProblem(401, ERROR_CODES.AUTH_USER_NOT_FOUND)
			}

			const level = await getLevelByXxHash(body.hash)
			if (level) {
				await removeFavourite(user.id, level.id)
			}

			set.status = 200
		},
	)
