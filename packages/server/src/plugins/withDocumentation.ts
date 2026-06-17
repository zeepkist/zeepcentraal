import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';

export const withDocumentation = new Elysia().use(
	openapi({
		documentation: {
			info: {
				title: 'ZeepCentraal API V3',
				version: '0.1.0',
			},
			tags: [
				{ name: 'auth' },
				{ name: 'user' },
				{ name: 'record' },
				{ name: 'vote' },
				{ name: 'job' },
			],
		},
	}),
);
