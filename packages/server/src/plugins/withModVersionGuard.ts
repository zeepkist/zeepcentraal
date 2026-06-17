import { isModOutdated } from '@zeepkist/database/services';
import { Elysia } from 'elysia';
import { V1_ERROR_CODES, V1HttpError } from '../v1Errors';

export const withModVersionGuard = new Elysia().derive(async ({ body }) => {
	const payload = (body ?? {}) as { ModVersion?: string };
	if (!payload.ModVersion) {
		throw new V1HttpError(V1_ERROR_CODES.GENERIC_INVALID_REQUEST, 400);
	}

	if (await isModOutdated(payload.ModVersion)) {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_MOD_OUTDATED, 400);
	}

	return {
		modVersion: payload.ModVersion,
	};
});
