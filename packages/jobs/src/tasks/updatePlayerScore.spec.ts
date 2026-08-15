import { beforeEach, expect, mock, test } from 'bun:test'

const recalculateAndPersistPlayerScore = mock(
	async (_options: {
		idUser: number
		initialContributions?: never[]
		onSnapshotMismatch?: (attempt: number) => void
	}) => ({
		contributions: [],
		points: 6324,
		totalPoints: 6324,
	}),
)

mock.module('../utils/recalculatePlayerScore', () => ({ recalculateAndPersistPlayerScore }))

const { updatePlayerScore } = await import('./updatePlayerScore')

beforeEach(() => {
	recalculateAndPersistPlayerScore.mockClear()
})

test('logs start and completion timings', async () => {
	const info = mock((..._args: unknown[]) => {})

	await updatePlayerScore({ idUser: 42 }, {
		logger: { error: mock(() => {}), info, warn: mock(() => {}) },
	} as never)

	expect(info.mock.calls[0]?.[0]).toBe('updatePlayerScore started for idUser=42.')
	expect(info).toHaveBeenCalledWith('updatePlayerScore completed for idUser=42.', {
		totalMs: expect.any(Number),
	})
	expect(recalculateAndPersistPlayerScore).toHaveBeenCalledWith({
		idUser: 42,
		onSnapshotMismatch: expect.any(Function),
	})
})

test('logs and retries a changed contribution snapshot through shared persistence', async () => {
	const warn = mock((..._args: unknown[]) => {})
	recalculateAndPersistPlayerScore.mockImplementationOnce(async ({ onSnapshotMismatch }) => {
		onSnapshotMismatch?.(1)
		return { contributions: [], points: 0, totalPoints: 0 }
	})

	await updatePlayerScore({ idUser: 42 }, {
		logger: { error: mock(() => {}), info: mock(() => {}), warn },
	} as never)

	expect(warn).toHaveBeenCalledWith(
		'Player contribution snapshot changed for idUser=42; retrying (1/3).',
	)
})

test('skips malformed queued payloads', async () => {
	const warn = mock((..._args: unknown[]) => {})

	await updatePlayerScore({}, {
		logger: { error: mock(() => {}), info: mock(() => {}), warn },
	} as never)

	expect(recalculateAndPersistPlayerScore).not.toHaveBeenCalled()
	expect(warn).toHaveBeenCalledWith('updatePlayerScore skipped: missing idUser payload.')
})
