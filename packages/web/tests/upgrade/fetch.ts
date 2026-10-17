// Load before the production entrypoint so fixed external URLs use local test data.
const originalFetch = globalThis.fetch
globalThis.fetch = Object.assign(
	(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
		const url = new URL(input instanceof Request ? input.url : String(input))
		if (url.hostname === 'api.steampowered.com')
			return Promise.resolve(Response.json({ appnews: { newsitems: [] } }))
		if (url.hostname === 'api.github.com')
			return Promise.resolve(
				Response.json({
					data: { repository: { latestRelease: null, releases: { nodes: [] } } },
				}),
			)
		return originalFetch(input, init)
	},
	originalFetch,
)
