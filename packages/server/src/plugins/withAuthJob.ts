import { config as coreConfig } from '@zeepkist/core';
import { Elysia } from 'elysia';
import { V1_ERROR_CODES, V1HttpError } from '../v1Errors';

export const withAuthJob = new Elysia().derive(({ request }) => {
	const authorization = request.headers.get('authorization');
	const expected = `Bearer ${coreConfig.job.triggerToken}`;

	if (!authorization || authorization !== expected) {
		throw new V1HttpError(V1_ERROR_CODES.AUTH_INVALID_TOKEN, 401);
	}

	return { jobAuth: true } as const;
});
