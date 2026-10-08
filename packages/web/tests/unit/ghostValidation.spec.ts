import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	extendValidationScriptCatalog,
	extractValidationBlock,
} from '../../scripts/validationManifest'
import { type ValidationAttempt, validationCsv } from '../../shared/ghostValidation'

describe('private validation evidence', () => {
	it('resolves sibling rendering scripts through matching metadata and preserves provenance', async () => {
		const root = await mkdtemp(join(tmpdir(), 'validation-scripts-'))
		try {
			const directory = join(root, 'Unity.TextMeshPro', 'TMPro')
			await mkdir(directory, { recursive: true })
			const guid = '12345678901234567890123456789012'
			await writeFile(join(directory, 'TextMeshPro.cs.meta'), `guid: ${guid}\n`)
			await writeFile(join(directory, 'TextMeshPro.cs'), 'class TextMeshPro {}')
			const scripts = new Map<string, string>()
			const digest = createHash('sha256')
			await extendValidationScriptCatalog(join(root, 'Zeepkist'), scripts, digest)
			expect(scripts.get(guid)).toBe('TextMeshPro')
			const original = digest.digest('hex')
			await writeFile(join(directory, 'TextMeshPro.cs'), 'class TextMeshPro { int changed; }')
			const changed = createHash('sha256')
			await extendValidationScriptCatalog(join(root, 'Zeepkist'), new Map(), changed)
			expect(changed.digest('hex')).not.toBe(original)
			await expect(
				extendValidationScriptCatalog(
					join(root, 'Zeepkist'),
					scripts,
					createHash('sha256'),
				),
			).rejects.toThrow('repeats GUID')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
	it('escapes spreadsheet formulas and quotes', () => {
		const row = {
			id: '1',
			id_record: 1,
			id_level: '1',
			status: '=CMD',
			created_at: 'today',
			updated_at: 'changed-today',
			validator_version: 'v1',
			ghost_digest: null,
			level_xx_hash: null,
			report: {
				status: '=CMD',
				validatorVersion: 'v1',
				reasons: ['"quoted"'],
				matchedGroups: [],
				missingGroups: [['@uid']],
			},
		} satisfies ValidationAttempt
		const csv = validationCsv([row])
		expect(csv).toContain('"\'=CMD"')
		expect(csv).toContain('""quoted""')
		expect(csv).toContain('"changed-today"')
	})
	it('requires resolved script metadata before extracting physics', async () => {
		const result = await extractValidationBlock(
			'--- !u!114 &1\nMonoBehaviour:\n  blockID: 22\n  m_Script: {fileID: 11500000, guid: abc, type: 3}\n',
			new Map(),
			async () => [],
		)
		expect(result).toBeNull()
	})
})
