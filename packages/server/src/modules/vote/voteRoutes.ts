import { Elysia, t } from 'elysia';
import { getLevel, getUser, upsertVote } from '@zeepkist/database/services';
import { verifyAccessToken } from '@zeepkist/core';
import { withAuthRequest } from '../../plugins/withAuth';

function getCookieToken(cookieHeader?: string): string | null {
	if (!cookieHeader) {
		return null;
	}

	for (const item of cookieHeader.split(';')) {
		const [key, ...rest] = item.trim().split('=');
		if (key === 'zeepcentral_access_token') {
			return decodeURIComponent(rest.join('='));
		}
	}

	return null;
}

export const voteRoutes = new Elysia({ prefix: '/vote' })
	.use(withAuthRequest)
	.post('/submit', async ({ headers, body, set }) => {
		const token = headers.authorization?.split(' ')[1] ?? getCookieToken(headers.cookie);
		if (!token) {
			set.status = 400;
			return {
				error: {
					code: 14,
					message: 'Not authenticated',
				},
			};
		}

		let auth;
		try {
			auth = verifyAccessToken(token);
		} catch {
			set.status = 401;
			return {
				error: {
					code: 15,
					message: 'Invalid or expired token',
				},
			};
		}

		const { Level, Value } = body;

		if (!Level || Value === undefined) {
			set.status = 400;
			return {
				error: {
					code: 17,
					message: 'Missing required parameters',
				},
			};
		}

		const user = await getUser(auth.steamId);
		if (!user) {
			set.status = 401;
			return {
				error: {
					code: 16,
					message: 'User not found',
				},
			};
		}

		const level = await getLevel(Level);
		if (!level) {
			set.status = 400;
			return {
				error: {
					code: 18,
					message: 'Level not found',
				},
			};
		}

		await upsertVote(user.id, level.id, Value);

		set.status = 200;
		return;
	}, {
		body: t.Object({
			Level: t.String(),
			Value: t.Union([t.Literal(-2), t.Literal(-1), t.Literal(0), t.Literal(1), t.Literal(2)]),
		}),
	});
