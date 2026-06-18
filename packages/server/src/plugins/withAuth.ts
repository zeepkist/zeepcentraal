import {
	type AccessTokenPayload,
	COOKIES,
	getCookie,
	jwtProvider,
	verifyAccessToken,
} from '@zeepkist/core'
import type { Elysia } from 'elysia'
import { V1_ERROR_CODES, V1HttpError } from '../v1Errors'

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
			throw new V1HttpError(V1_ERROR_CODES.AUTH_MISSING_TOKEN, 400)
		}

		let payload: AccessTokenPayload
		try {
			payload = verifyAccessToken(token)
		} catch {
			throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401)
		}

		if (payload.provider !== jwtProvider.gtr) {
			throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401)
		}

		return { auth: payload }
	})

export const withAuthRequest = (app: Elysia) =>
	app.derive(({ headers }) => {
		const token =
			getBearerToken(headers.authorization) ?? getCookie(headers.cookie, COOKIES.AccessToken)
		if (!token) {
			throw new V1HttpError(V1_ERROR_CODES.AUTH_MISSING_TOKEN, 400)
		}

		let payload: AccessTokenPayload
		try {
			payload = verifyAccessToken(token)
		} catch {
			throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401)
		}

		const isAllowedProvider = [
			jwtProvider.steam,
			jwtProvider.discord,
			jwtProvider.gtr,
		].includes(payload.provider)
		if (!isAllowedProvider) {
			throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401)
		}

		return { auth: payload }
	})
