import { expect, test } from '@playwright/test'

test('SEO discovery preserves sitemap chunks and private-route exclusions', async ({ request }) => {
	const development = process.env.PLAYWRIGHT_HYDRATION_RUNTIME === 'development'
	const robots = await request.get('/robots.txt')
	expect(robots.status()).toBe(200)
	if (development) {
		expect(await robots.text()).toContain('Disallow: /')
	} else {
		expect(await robots.text()).toContain('/settings')
		expect(await robots.text()).toContain('/records/me')
	}
	const sitemap = await request.get('/sitemap.xml')
	expect(sitemap.status()).toBe(200)
	const index = await sitemap.text()
	expect(index).toContain('<sitemapindex')
	expect(index).toContain('/sitemaps/records/0.xml')
	expect(index).not.toContain('/settings')
	expect(index).not.toContain('/records/me')
	const chunk = await request.get('/sitemaps/records/0.xml')
	expect(chunk.status()).toBe(200)
	expect(chunk.headers()['cache-control']).toBe('s-maxage=600, stale-while-revalidate')
	expect(await chunk.text()).toContain('<urlset')
	for (const path of ['/llms.txt', '/llms-full.txt', '/sitemap.md']) {
		const response = await request.get(path)
		expect(response.status(), path).toBe(200)
		const text = await response.text()
		expect(text, path).not.toMatch(
			/https:\/\/zeepki\.st\/(?:settings|records\/me)(?:[/.\s"<#?]|$)/,
		)
	}
})

test('AI Ready serves public Markdown and preserves HTML responses', async ({ request }) => {
	for (const path of ['/support', '/privacy']) {
		const html = await request.get(path, { headers: { accept: 'text/html' } })
		expect(html.status(), path).toBe(200)
		expect(html.headers()['content-type']).toContain('text/html')
		expect(await html.text()).toContain('<!DOCTYPE html>')
		const negotiated = await request.get(path, {
			headers: { accept: 'text/markdown' },
			maxRedirects: 0,
		})
		expect(negotiated.status(), path).toBe(307)
		expect(negotiated.headers().location).toContain(`${path}.md`)
		const markdown = await request.get(`${path}.md`)
		expect(markdown.status(), path).toBe(200)
		expect(markdown.headers()['content-type']).toContain('text/markdown')
		expect(await markdown.text()).not.toContain('<!DOCTYPE html>')
	}
})

test('signed OG images render and Records routes share one card', async ({ request }) => {
	test.setTimeout(120_000)
	const images: string[] = []
	for (const path of ['/', '/privacy', '/records', '/record/9001']) {
		const html = await request.get(path)
		expect(html.status(), path).toBe(200)
		const image = (await html.text()).match(
			/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/,
		)?.[1]
		expect(image, path).toBeTruthy()
		if (!image) throw new Error(`Missing OG image for ${path}`)
		const url = new URL(image.replaceAll('&amp;', '&'), 'http://127.0.0.1:4173')
		images.push(url.pathname)
		const response = await request.get(`${url.pathname}${url.search}`)
		expect(response.status(), path).toBe(200)
		expect(response.headers()['content-type']).toContain('image/png')
		const bytes = await response.body()
		expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
		expect(bytes.readUInt32BE(16)).toBe(1200)
		expect(bytes.readUInt32BE(20)).toBe(630)
		await test.info().attach(`OG image ${path}`, { body: bytes, contentType: 'image/png' })
		if (process.env.PLAYWRIGHT_HYDRATION_RUNTIME !== 'development') {
			expect(decodeURIComponent(url.pathname)).toContain(',s_')
			const tampered = url.pathname.replace(/(%2C|,)s_/i, '$1s_invalid')
			expect((await request.get(tampered)).status()).toBe(403)
		}
	}
	expect(images[2]).toBe(images[3])
})
