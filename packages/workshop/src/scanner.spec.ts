import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STEAM_VISIBILITY } from '@zeepkist/core/steam'
import { downloadBatchesRecursively, WorkshopScanner, ZSL_WORKSHOP_AUTHOR_ID } from './scanner'
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
	validation = '10,11,12,13,1,-1',
	block = '22,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
} = {}): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'workshop-scanner-test-'))
	temporaryDirectories.push(root)
	const levelDirectory = join(root, 'Example')
	await mkdir(levelDirectory)
	await writeFile(
		join(levelDirectory, 'Example.zeeplevel'),
		['LevelEditor2,File Author,file-uid', '0,0,0,0,0,0,0,0', validation, block].join('\n'),
	)
	if (thumbnail) {
		await writeFile(join(levelDirectory, 'Example_Thumbnail.jpg'), 'image')
	}
	if (extraThumbnail) {
		await writeFile(join(levelDirectory, 'Example_Thumbnail.jpg.png'), 'image')
	}
	return root
}

async function createItemWithoutLevelFile(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'workshop-scanner-test-'))
	temporaryDirectories.push(root)
	await mkdir(join(root, 'Example'))
	return root
}

async function createJsonExponentItem(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'workshop-scanner-test-'))
	temporaryDirectories.push(root)
	const levelDirectory = join(root, 'Example')
	await mkdir(levelDirectory)
	await writeFile(
		join(levelDirectory, 'Example.zeeplevel'),
		'{"jsonVersion":3,"level":{"name":"Example","UID":"uid-json-exponent","zeepHash":"legacy-json-exponent"},"author":{"name":"Author","StmID":76561198896246340},"medals":{"author":1,"gold":2,"silver":3,"bronze":4},"enviro":{"skybox":1,"groundMat":-1},"blox":[{"i":1609,"u":"exp","p":{"x":6.41169463E-21,"y":0,"z":0},"r":{"x":0,"y":0,"z":0},"s":{"x":1,"y":1,"z":1},"d":{"n":{"p0":1}}}]}',
	)
	await writeFile(join(levelDirectory, 'Example_Thumbnail.jpg'), 'image')
	return root
}

async function createMixedZslItem(): Promise<string> {
	const root = await createItem({ thumbnail: false })
	const jsonDirectory = join(root, 'Json Example')
	await mkdir(jsonDirectory)
	await writeFile(
		join(jsonDirectory, 'Json Example.zeeplevel'),
		JSON.stringify({
			jsonVersion: 3,
			level: { name: 'Json Example', UID: 'json-uid', zeepHash: 'json-zeep-hash' },
			author: { name: 'JSON Author', StmID: '76561198033333333' },
			medals: { author: 1, gold: 2, silver: 3, bronze: 4 },
			enviro: { skybox: 1, groundMat: -1 },
			blox: [],
		}),
	)
	return root
}

async function createJsonItemWithoutSteamId(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'workshop-scanner-test-'))
	temporaryDirectories.push(root)
	const levelDirectory = join(root, 'Example')
	await mkdir(levelDirectory)
	await writeFile(
		join(levelDirectory, 'Example.zeeplevel'),
		JSON.stringify({
			jsonVersion: 3,
			level: { name: 'Example', UID: 'json-uid', zeepHash: 'json-zeep-hash' },
			author: { name: 'Unknown Author' },
			medals: { author: 1, gold: 2, silver: 3, bronze: 4 },
			enviro: { skybox: 1, groundMat: -1 },
			blox: [],
		}),
	)
	return root
}

function createDependencies({
	directory,
	available = true,
	creatorId = 76561198000000000n,
	foundLevelAuthorId,
	visibility = STEAM_VISIBILITY.Public,
	upsertResult = { idLevel: 42, scoreChanged: true },
}: {
	directory: string
	available?: boolean
	creatorId?: bigint
	foundLevelAuthorId?: bigint
	visibility?: number
	upsertResult?: { idLevel: number; scoreChanged: boolean }
}) {
	const calls = {
		upserts: [] as Array<Record<string, unknown>>,
		markDeleted: [] as Array<{
			workshopId: bigint
			workshopVisibility: number
		}>,
		markMissing: [] as string[],
		merges: [] as Array<Record<string, unknown>>,
		authorLookups: [] as Array<{ excludedUploaderId: bigint; xxHash: string }>,
		uploads: 0,
		cleanups: 0,
		downloads: 0,
	}
	const metadata: WorkshopMetadataAdapter = {
		getItems: async ([workshopId]) => [
			{
				workshopId: workshopId as bigint,
				creatorId,
				name: 'Example Workshop Item',
				imageUrl: 'https://steam.example/workshop-preview.jpg',
				visibility,
				fileSize: 1234,
				createdAt: '2023-01-01T00:00:00.000Z',
				updatedAt: '2023-01-02T00:00:00.000Z',
				available,
			},
		],
		listItems: async () => ({ items: [] }),
		listUserItemIds: async () => ({ workshopIds: [] }),
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
		findLevelAuthorByXxHash: async (xxHash, excludedUploaderId) => {
			calls.authorLookups.push({ xxHash, excludedUploaderId })
			return foundLevelAuthorId
		},
		upsertLevel: async (input) => {
			calls.upserts.push(input)
			return upsertResult
		},
		markMissing: async (_workshopId, activeXxHashes) => {
			calls.markMissing = activeXxHashes
			return []
		},
		markDeleted: async (workshopId, workshopVisibility) => {
			calls.markDeleted.push({ workshopId, workshopVisibility })
			return [7]
		},
		uploadThumbnail: async () => {
			calls.uploads++
			return 'thumbnails/generated.jpg'
		},
		mergeZeepSdkExponentHash: async (input) => {
			calls.merges.push(input)
			return { merged: true, changedLevelIds: [input.correctLevelId] }
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
		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(76561198000000000n)
		expect(dependencies.calls.authorLookups).toEqual([])
		expect(dependencies.calls.upserts[0]?.workshopName).toBe('Example Workshop Item')
		expect(dependencies.calls.upserts[0]?.workshopImageUrl).toBe(
			'https://steam.example/workshop-preview.jpg',
		)
		expect(dependencies.calls.upserts[0]?.workshopVisibility).toBe(0)
		expect(dependencies.calls.upserts[0]?.workshopFileSize).toBe(1234)
		expect(dependencies.calls.upserts[0]?.hash).toBe('5B7A81C7A6181599CD15234CA17797BBEBFACBD3')
		expect(dependencies.calls.upserts[0]?.xxHash).toBe('5FC86C702B3F328B66608DC3C8BFB603')
		expect(dependencies.calls.upserts[0]?.imageUrl).toBe('thumbnails/generated.jpg')
		expect(dependencies.calls.markMissing).toEqual(['5FC86C702B3F328B66608DC3C8BFB603'])
		expect(dependencies.calls.cleanups).toBe(1)
	})

	test('uses matching existing author for CSV levels in ZSL packs', async () => {
		const directory = await createItem()
		const dependencies = createDependencies({
			directory,
			creatorId: ZSL_WORKSHOP_AUTHOR_ID,
			foundLevelAuthorId: 76561198011111111n,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(dependencies.calls.authorLookups).toEqual([
			{
				xxHash: '5FC86C702B3F328B66608DC3C8BFB603',
				excludedUploaderId: ZSL_WORKSHOP_AUTHOR_ID,
			},
		])
		expect(dependencies.calls.upserts[0]?.authorId).toBe(ZSL_WORKSHOP_AUTHOR_ID)
		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(76561198011111111n)
	})

	test('falls back to ZSL uploader when CSV author cannot be resolved', async () => {
		const directory = await createItem()
		const dependencies = createDependencies({
			directory,
			creatorId: ZSL_WORKSHOP_AUTHOR_ID,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(ZSL_WORKSHOP_AUTHOR_ID)
	})

	test('uses matching existing author instead of rounded JSON SteamID in ZSL packs', async () => {
		const directory = await createJsonExponentItem()
		const dependencies = createDependencies({
			directory,
			creatorId: ZSL_WORKSHOP_AUTHOR_ID,
			foundLevelAuthorId: 76561198896246339n,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(dependencies.calls.authorLookups).toHaveLength(1)
		expect(dependencies.calls.upserts[0]?.authorId).toBe(ZSL_WORKSHOP_AUTHOR_ID)
		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(76561198896246339n)
	})

	test('falls back to ZSL uploader instead of rounded JSON SteamID without a match', async () => {
		const directory = await createJsonExponentItem()
		const dependencies = createDependencies({
			directory,
			creatorId: ZSL_WORKSHOP_AUTHOR_ID,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(dependencies.calls.authorLookups).toHaveLength(1)
		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(ZSL_WORKSHOP_AUTHOR_ID)
	})

	test('keeps Workshop uploader as JSON level author outside ZSL', async () => {
		const directory = await createJsonExponentItem()
		const dependencies = createDependencies({
			directory,
			creatorId: 76561198022222222n,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(76561198022222222n)
	})

	test('falls back to ZSL uploader when JSON SteamID is missing', async () => {
		const directory = await createJsonItemWithoutSteamId()
		const dependencies = createDependencies({
			directory,
			creatorId: ZSL_WORKSHOP_AUTHOR_ID,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(dependencies.calls.authorLookups).toHaveLength(1)
		expect(dependencies.calls.upserts[0]?.levelAuthorId).toBe(ZSL_WORKSHOP_AUTHOR_ID)
	})

	test('resolves CSV and JSON authors through matching existing level items', async () => {
		const directory = await createMixedZslItem()
		const dependencies = createDependencies({
			directory,
			creatorId: ZSL_WORKSHOP_AUTHOR_ID,
			foundLevelAuthorId: 76561198011111111n,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await scanner.scanWorkshopItem(1n)

		expect(
			Object.fromEntries(
				dependencies.calls.upserts.map((input) => [input.name, input.levelAuthorId]),
			),
		).toEqual({
			Example: 76561198011111111n,
			'Json Example': 76561198011111111n,
		})
		expect(dependencies.calls.authorLookups).toHaveLength(2)
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

	test('accepts invalid metadata and stores normalized defaults', async () => {
		const directory = await createItem({
			validation: 'NaN,Infinity,not-a-time,,1,-1',
		})
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n)

		expect(result.status).toBe('scanned')
		expect(dependencies.calls.upserts[0]?.validationTimeAuthor).toBe(0)
		expect(dependencies.calls.upserts[0]?.validationTimeGold).toBe(0)
		expect(dependencies.calls.upserts[0]?.validationTimeSilver).toBe(0)
		expect(dependencies.calls.upserts[0]?.validationTimeBronze).toBe(0)
		expect(dependencies.calls.upserts[0]?.xxHash).toBe('5FC86C702B3F328B66608DC3C8BFB603')
	})

	test('rejects missing .zeeplevel file', async () => {
		const directory = await createItemWithoutLevelFile()
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		await expect(scanner.scanWorkshopItem(1n)).rejects.toThrow(
			'Workshop item contains no complete levels',
		)
	})

	test('accepts invalid CSV block ids and stores normalized hashes', async () => {
		const directory = await createItem({
			block: 'not-a-number,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
		})
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(3749321871n)

		expect(result.status).toBe('scanned')
		expect(dependencies.calls.upserts[0]?.hash).toBe('CB7E7D2B30617A987B02008F663B2C63F74713C7')
		expect(dependencies.calls.upserts[0]?.xxHash).toBe('02A8289FA8BDC7FA81642538758D1AA1')
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
		expect(dependencies.calls.markDeleted).toEqual([
			{
				workshopId: 2n,
				workshopVisibility: STEAM_VISIBILITY.Hidden,
			},
		])
		expect(dependencies.calls.downloads).toBe(0)
	})

	test('downloads unlisted items', async () => {
		const directory = await createItem()
		const dependencies = createDependencies({
			directory,
			visibility: STEAM_VISIBILITY.Unlisted,
		})
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n)

		expect(result.status).toBe('scanned')
		expect(dependencies.calls.downloads).toBe(1)
		expect(dependencies.calls.markDeleted).toEqual([])
		expect(dependencies.calls.upserts[0]?.workshopVisibility).toBe(STEAM_VISIBILITY.Unlisted)
	})

	for (const [label, visibility] of [
		['friends-only', STEAM_VISIBILITY.FriendsOnly],
		['hidden', STEAM_VISIBILITY.Hidden],
	] as const) {
		test(`marks ${label} items inaccessible without downloading`, async () => {
			const dependencies = createDependencies({
				directory: 'unused',
				visibility,
			})
			const scanner = new WorkshopScanner(
				dependencies.metadata,
				dependencies.downloader,
				dependencies.persistence,
			)

			const result = await scanner.scanWorkshopItem(1n)

			expect(result).toEqual({
				workshopId: 1n,
				status: 'inaccessible',
				changedLevelIds: [7],
			})
			expect(dependencies.calls.markDeleted).toEqual([
				{ workshopId: 1n, workshopVisibility: visibility },
			])
			expect(dependencies.calls.downloads).toBe(0)
			expect(dependencies.calls.upserts).toHaveLength(0)
		})
	}

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

	test('passes legacy ZeepSDK exponent hash from raw downloaded JSON when enabled', async () => {
		const directory = await createJsonExponentItem()
		const dependencies = createDependencies({ directory })
		const scanner = new WorkshopScanner(
			dependencies.metadata,
			dependencies.downloader,
			dependencies.persistence,
		)

		const result = await scanner.scanWorkshopItem(1n, { fixZeepSDKExponentHashes: true })

		expect(result.changedLevelIds).toEqual([42])
		expect(dependencies.calls.merges).toEqual([
			{
				correctLevelId: 42,
				correctXxHash: dependencies.calls.upserts[0]?.xxHash,
				badXxHash: '180F9BCEE2567B31ABB696D6B01FC3E4',
				workshopId: 1n,
				fileUid: 'uid-json-exponent',
			},
		])
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
