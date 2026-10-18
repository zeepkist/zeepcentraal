import { describe, expect, test } from 'bun:test'
import { getHttpErrorStatus, isHttpNotFoundError } from './httpError'

describe('HTTP error status metadata', () => {
	test.each([
		{ status: 404 },
		{ statusCode: 404 },
		{ response: new Response(null, { status: 404 }) },
		Object.assign(new Error('Page not found'), { statusCode: 404 }),
	])('recognises confirmed not-found errors: %p', (error) => {
		expect(getHttpErrorStatus(error)).toBe(404)
		expect(isHttpNotFoundError(error)).toBe(true)
	})

	test.each([
		undefined,
		null,
		'Page not found: /missing',
		new Error('Page not found'),
		{ message: '404 Page not found' },
		{ status: '404' },
		{ status: 500, statusCode: 404 },
		{ statusCode: 500, response: { status: 404 } },
		{ status: 403, message: 'Page not found' },
		{ status: 404.5 },
		{ status: 999 },
	])('does not suppress unconfirmed or other errors: %p', (error) => {
		expect(isHttpNotFoundError(error)).toBe(false)
	})
})
