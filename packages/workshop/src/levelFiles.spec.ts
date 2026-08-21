import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseLevelV2 } from '@zeepkist/core/levels'
import { findWorkshopLevelFile } from './levelFiles'

const temporaryDirectories: string[] = []

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
	)
})

test('finds exact UID while skipping malformed sibling levels', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'level-files-test-'))
	temporaryDirectories.push(directory)
	const content = await readFile(
		new URL('../../core/testdata/legacy-hash/small.zeeplevel', import.meta.url),
		'utf8',
	)
	const uid = parseLevelV2(content).uid
	await writeFile(join(directory, 'a-invalid.zeeplevel'), 'invalid')
	await writeFile(join(directory, 'b-selected.zeeplevel'), content)

	const found = await findWorkshopLevelFile(directory, uid)
	expect(found?.fileUid).toBe(uid)
	expect(found?.name).toBe('b-selected')
})
