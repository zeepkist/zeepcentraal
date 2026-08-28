import {
	type AccessTokenPayload,
	COOKIES,
	getCookie,
	jwtProvider,
	verifyAccessToken,
} from '@zeepkist/core'
import type { Elysia } from 'elysia'
import { ERROR_CODES, ProblemError } from '../problems'

function getBearerToken(authorization?: string): string | null {
	if (!authorization?.startsWith('Bearer ')) {
		return null
	}

	return authorization.slice(7)
}

export const withAuthGtr = (app: Elysia) =>
	app.derive(({ headers }) => {
		const token = getBearerToken(headers.authorization)
		if (!token) {
			throw new ProblemError(400, ERROR_CODES.AUTH_MISSING_TOKEN)
		}

		let payload: AccessTokenPayload
		try {
			payload = verifyAccessToken(token)
		} catch {
			throw new ProblemError(401, ERROR_CODES.AUTH_INVALID_TOKEN)
		}

		if (payload.provider !== jwtProvider.gtr) {
			throw new ProblemError(401, ERROR_CODES.AUTH_INVALID_TOKEN)
		}

		return { auth: payload }
	})

export const withAuthRequest = (app: Elysia) =>
	app.derive(({ headers }) => {
		const token =
			getBearerToken(headers.authorization) ?? getCookie(headers.cookie, COOKIES.AccessToken)
		if (!token) {
			throw new ProblemError(400, ERROR_CODES.AUTH_MISSING_TOKEN)
		}

		let payload: AccessTokenPayload
		try {
			payload = verifyAccessToken(token)
		} catch {
			throw new ProblemError(401, ERROR_CODES.AUTH_INVALID_TOKEN)
		}

		const isAllowedProvider = [
			jwtProvider.steam,
			jwtProvider.discord,
			jwtProvider.gtr,
		].includes(payload.provider)
		if (!isAllowedProvider) {
			throw new ProblemError(401, ERROR_CODES.AUTH_INVALID_TOKEN)
		}

		return { auth: payload }
	})
