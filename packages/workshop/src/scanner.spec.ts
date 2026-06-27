import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadBatchesRecursively, WorkshopScanner } from './scanner'
import type { WorkshopDownloader, WorkshopMetadataAdapter, WorkshopPersistence } from './types'

const temporaryDirectories: string[] = []

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	)
})

async function createItem({
	thumbnail = true,
	extraThumbnail = false,
	block = '22,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
} = {}): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'workshop-scanner-test-'))
	temporaryDirectories.push(root)
	const levelDirectory = join(root, 'Example')
	await mkdir(levelDirectory)
	await writeFile(
		join(levelDirectory, 'Example.zeeplevel'),
		['LevelEditor2,File Author,file-uid', '0,0,0,0,0,0,0,0', '10,11,12,13,1,-1', block].join(
			'\n',
		),
	)
	if (thumbnail) {
		await writeFile(join(levelDirectory, 'Example_Thumbnail.jpg'), 'image')
	}
	if (extraThumbnail) {
		await writeFile(join(levelDirectory, 'Example_Thumbnail.jpg.png'), 'image')
	}
	return root
}

function createDependencies({
	directory,
	available = true,
	upsertResult = { idLevel: 42, scoreChanged: true },
}: {
	directory: string
	available?: boolean
	upsertResult?: { idLevel: number; scoreChanged: boolean }
}) {
	const calls = {
		upserts: [] as Array<Record<string, unknown>>,
		markDeleted: 0,
		markMissing: [] as string[],
		uploads: 0,
		cleanups: 0,
		downloads: 0,
	}
	const metadata: WorkshopMetadataAdapter = {
		getItems: async ([workshopId]) => [
			{
				workshopId: workshopId as bigint,
				creatorId: 76561198000000000n,
				name: 'Example Workshop Item',
				imageUrl: 'https://steam.example/workshop-preview.jpg',
				createdAt: '2023-01-01T00:00:00.000Z',
				updatedAt: '2023-01-02T00:00:00.000Z',
				available,
			},
		],
		listItems: async () => ({ items: [] }),
	}
	const downloader: WorkshopDownloader = {
		download: async ([workshopId]) => {
			calls.downloads++
			return {
				items: [{ workshopId: workshopId as bigint, directory }],
				cleanup: async () => {
					calls.cleanups++
				},
			}
		},
	}
	const persistence: WorkshopPersistence = {
		upsertLevel: async (input) => {
			calls.upserts.push(input)
			return upsertResult
		},
		markMissing: async (_workshopId, activeXxHashes) => {
			calls.markMissing = activeXxHashes
			return []
		},
		markDeleted: async () => {
			calls.markDeleted++
			return [7]
		},
		uploadThumbnail: async () => {
			calls.uploads++
			return 'thumbnails/generated.jpg'
		},
	}
	return { calls, metadata, downloader, persistence }
}

describe('WorkshopScanner', () => {
	test('parses complete item before reconciling rows', async () => {
		const directory = await createItem()
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(3749321871n)

		expect(result).toEqual({
			workshopId: 3749321871n,
			status: 'scanned',
			changedLevelIds: [42],
		})
		expect(dependencies.calls.upserts).toHaveLength(1)
		expect(dependencies.calls.upserts[0]?.authorId).toBe(76561198000000000n)
		expect(dependencies.calls.upserts[0]?.workshopName).toBe('Example Workshop Item')
		expect(dependencies.calls.upserts[0]?.workshopImageUrl).toBe(
			'https://steam.example/workshop-preview.jpg',
		)
		expect(dependencies.calls.upserts[0]?.hash).toBe('5B7A81C7A6181599CD15234CA17797BBEBFACBD3')
		expect(dependencies.calls.upserts[0]?.xxHash).toBe('5FC86C702B3F328B66608DC3C8BFB603')
		expect(dependencies.calls.upserts[0]?.imageUrl).toBe('thumbnails/generated.jpg')
		expect(dependencies.calls.markMissing).toEqual(['5FC86C702B3F328B66608DC3C8BFB603'])
		expect(dependencies.calls.cleanups).toBe(1)
	})

	test('scans item without thumbnail using empty image URL', async () => {
		const directory = await createItem({ thumbnail: false })
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n)

		expect(result.status).toBe('scanned')
		expect(dependencies.calls.uploads).toBe(0)
		expect(dependencies.calls.upserts[0]?.imageUrl).toBe('')
		expect(dependencies.calls.cleanups).toBe(1)
	})

	test('prefers jpg thumbnail and ignores extra thumbnails', async () => {
		const directory = await createItem({ extraThumbnail: true })
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n)

		expect(result.status).toBe('scanned')
		expect(dependencies.calls.uploads).toBe(1)
		expect(dependencies.calls.upserts[0]?.imageUrl).toBe('thumbnails/generated.jpg')
		expect(dependencies.calls.cleanups).toBe(1)
	})

	test('adds workshop id and level file name to validation errors', async () => {
		const directory = await createItem({
			block: 'not-a-number,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
		})
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		try {
			await scanner.scanWorkshopItem(3749321871n)
			throw new Error('Expected scan to fail')
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const message = (error as Error).message
			expect(message).toContain('Workshop 3749321871 level Example')
			expect(message).toContain('Example.zeeplevel')
			expect(message).toContain('Invalid block id')
		}
	})

	test('marks permanent metadata failures deleted without downloading', async () => {
		const dependencies = createDependencies({ directory: 'unused', available: false })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(2n)

		expect(result.status).toBe('permanently-unavailable')
		expect(result.changedLevelIds).toEqual([7])
		expect(dependencies.calls.markDeleted).toBe(1)
		expect(dependencies.calls.downloads).toBe(0)
	})

	test('does not report unchanged upserted levels as changed', async () => {
		const directory = await createItem()
		const dependencies = createDependencies({
			directory,
			upsertResult: { idLevel: 42, scoreChanged: false },
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n)

		expect(result.status).toBe('scanned')
		expect(result.changedLevelIds).toEqual([])
	})

	test('reports reappearing upserted levels as changed', async () => {
		const directory = await createItem()
		const dependencies = createDependencies({
			directory,
			upsertResult: { idLevel: 42, scoreChanged: true },
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n)

		expect(result.status).toBe('scanned')
		expect(result.changedLevelIds).toEqual([42])
	})
})

test('downloadBatchesRecursively isolates failed items', async () => {
	const attempts: string[] = []
	const failures: bigint[] = []
	await downloadBatchesRecursively(
		[1n, 2n, 3n, 4n],
		async (ids) => {
			attempts.push(ids.join(','))
			if (ids.includes(3n)) {
				throw new Error('failed')
			}
		},
		async (id) => {
			failures.push(id)
		},
		10,
	)
	expect(attempts).toEqual(['1,2,3,4', '1,2', '3,4', '3', '4'])
	expect(failures).toEqual([3n])
})
