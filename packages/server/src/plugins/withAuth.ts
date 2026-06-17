import { jwtProvider, verifyAccessToken } from '@zeepkist/core';
import { Elysia } from 'elysia';
import { V1_ERROR_CODES, V1HttpError } from '../v1Errors';

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

function getBearerToken(authorization?: string): string | null {
	if (!authorization?.startsWith('Bearer ')) {
		return null;
	}

	return authorization.slice(7);
}

export const withAuthGtr = new Elysia().derive(({ headers }) => {
	const token = getBearerToken(headers.authorization);
	if (!token) {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_MISSING_TOKEN, 400);
	}

	let payload;
	try {
		payload = verifyAccessToken(token);
	} catch {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401);
	}

	if (payload.provider !== jwtProvider.gtr) {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401);
	}

	return { auth: payload };
});

export const withAuthRequest = new Elysia().derive(({ headers }) => {
	const token = getBearerToken(headers.authorization) ?? getCookieToken(headers.cookie);
	if (!token) {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_MISSING_TOKEN, 400);
	}

	let payload;
	try {
		payload = verifyAccessToken(token);
	} catch {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401);
	}

	const isAllowedProvider = [jwtProvider.steam, jwtProvider.discord, jwtProvider.gtr].includes(
		payload.provider,
	);
	if (!isAllowedProvider) {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401);
	}

	return { auth: payload };
});
