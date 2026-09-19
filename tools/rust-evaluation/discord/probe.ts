export {}

const app = 'http://127.0.0.1:4310'
const fixture = 'http://127.0.0.1:4321'
if (process.argv[2] === 'health') {
	await fetch(`${app}/healthz`).then((r) => {
		if (!r.ok) throw new Error('Not ready')
	})
	console.log(JSON.stringify({ ok: true }))
} else if (process.argv[2] === 'smoke') {
	for (const [id, expected] of [
		[9001, 200],
		[9002, 200],
		[9003, 502],
	]) {
		const response = await fetch(`${app}/evaluation/discord`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ kind: 'feed', id }),
		})
		if (response.status !== expected) throw new Error(`Fault ${id}: ${response.status}`)
	}
	const state = (await fetch(`${fixture}/stats`).then((r) => r.json())) as {
		deliveries: number
		cursors: number
	}
	if (state.deliveries !== 2 || state.cursors !== 2) throw new Error('Failure advanced cursor')
	console.log(JSON.stringify({ ok: true, state }))
} else
	console.log(
		JSON.stringify({
			app: await fetch(`${app}/stats`).then((r) => r.json()),
			fixture: await fetch(`${fixture}/stats`).then((r) => r.json()),
		}),
	)
