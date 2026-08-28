import { expect, test } from 'bun:test'
import { RateLimitStore } from './withRateLimit'

test('expires counters across circular-wheel rollover', () => {
	using store = new RateLimitStore(100, false)
	expect(store.take('record:one', 1, 100).allowed).toBe(true)
	expect(store.take('record:one', 1, 159).allowed).toBe(false)
	expect(store.take('record:one', 1, 160).allowed).toBe(true)
	expect(store.size).toBe(1)
})

test('caps process-local identities at 10,000 and clears on disposal', () => {
	const store = new RateLimitStore(100, false)
	for (let index = 0; index < 10_000; index++) {
		expect(store.take(`record:${index}`, 1, 100).allowed).toBe(true)
	}
	expect(store.take('record:overflow', 1, 100)).toEqual({ allowed: false, retryAfter: 1 })
	expect(store.take('record:0', 2, 100).allowed).toBe(true)
	store[Symbol.dispose]()
	expect(store.size).toBe(0)
})

test('stores remain process-instance isolated', () => {
	using first = new RateLimitStore(100, false)
	using second = new RateLimitStore(100, false)
	first.take('record:same', 1, 100)
	expect(first.take('record:same', 1, 100).allowed).toBe(false)
	expect(second.take('record:same', 1, 100).allowed).toBe(true)
})
