import { describe, expect, it, vi } from 'vitest'
import download from '../../server/api/downloads/modkist/[channel]/[format].get'
import { createRequestEvent } from '../support/request-event'

vi.mock('../../server/utils/githubModkist', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../server/utils/githubModkist')>()),
	getModkistReleases: () => Promise.reject(new Error('Fixture unavailable')),
}))

describe('portable download redirects', () => {
	it('returns redirect body with existing fallback URL and HTTP 302', async () => {
		const event = createRequestEvent('/api/downloads/modkist/stable/msi')
		event.context.params = { channel: 'stable', format: 'msi' }
		const body = await download(event)
		expect(event.res.status).toBe(302)
		expect(event.res.headers.get('location')).toBe(
			'https://github.com/Thundernerd/ModkistMKII/releases',
		)
		expect(body).toContain('http-equiv="refresh"')
	})
	it('rejects unknown formats before fetching releases', async () => {
		const event = createRequestEvent('/api/downloads/modkist/stable/unknown')
		event.context.params = { channel: 'stable', format: 'unknown' }
		await expect(download(event)).rejects.toMatchObject({ statusCode: 404 })
	})
})
