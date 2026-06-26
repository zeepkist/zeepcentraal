import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { parseJsonLevelV2 } from '@zeepkist/core/levels'

const adventureAuthorId = '76561198041027402'
const adventureWorkshopId = '-1'

export interface AdventureMapEntry {
	uid: string
	levelName: string
}

export interface AdventureMigrationRow {
	uid: string
	xxHash: string
	series: string
	name: string
	imageUrl: string
	validationTimeAuthor: number
	validationTimeGold: number
	validationTimeSilver: number
	validationTimeBronze: number
	amountCheckpoints: number
	amountFinishes: number
	amountBlocks: number
	typeGround: number
	typeSkybox: number
	format: number
	blocks: unknown[]
}

interface CreateMigrationOptions {
	adventureRoot: string
	migrationsFolder: string
	tag?: string
	dryRun?: boolean
	allowEmpty?: boolean
}

interface DrizzleJournal {
	version: string
	dialect: string
	entries: {
		idx: number
		version: string
		when: number
		tag: string
		breakpoints: boolean
	}[]
}

function splitCsvLine(line: string): string[] {
	const values: string[] = []
	let current = ''
	let quoted = false

	for (let index = 0; index < line.length; index += 1) {
		const character = line[index]
		if (character === '"' && line[index + 1] === '"') {
			current += '"'
			index += 1
			continue
		}
		if (character === '"') {
			quoted = !quoted
			continue
		}
		if (character === ',' && !quoted) {
			values.push(current)
			current = ''
			continue
		}
		current += character
	}

	values.push(current)
	return values
}

export function parseAdventureMap(content: string): AdventureMapEntry[] {
	const lines = content
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
	const [header, ...rows] = lines
	if (!header) {
		throw new Error('Adventure map is empty')
	}
	const columns = splitCsvLine(header)
	const hashIndex = columns.indexOf('Hash')
	const levelNameIndex = columns.indexOf('Level Name')
	if (hashIndex === -1 || levelNameIndex === -1) {
		throw new Error('Adventure map must contain Hash and Level Name columns')
	}

	return rows.map((row, index) => {
		const values = splitCsvLine(row)
		const uid = values[hashIndex]?.trim()
		const levelName = values[levelNameIndex]?.trim()
		if (!uid || !levelName) {
			throw new Error(`Adventure map row ${index + 2} is missing Hash or Level Name`)
		}
		return { uid, levelName }
	})
}

export function getAdventureSeries(levelName: string): string {
	const name = getAdventureShortName(levelName)
	const [series] = name.split('-')
	if (!series) {
		throw new Error(`Unable to determine adventure series for ${levelName}`)
	}
	return series
}

export function getAdventureShortName(levelName: string): string {
	return levelName.replace(/^Level\s+/, '')
}

export function getAdventureImageUrl(series: string, name: string): string {
	return `assets/thumbnails/1/levels/${series}/${name}.avif`
}

function sqlString(value: string): string {
	return `'${value.replaceAll("'", "''")}'`
}

function sqlJson(value: unknown): string {
	return `${sqlString(JSON.stringify(value))}::jsonb`
}

function sqlNumber(value: number): string {
	if (!Number.isFinite(value)) {
		throw new Error(`Invalid numeric migration value: ${value}`)
	}
	return String(value)
}

function valuesList(rows: AdventureMigrationRow[]): string {
	return rows
		.map((row) =>
			[
				sqlString(row.uid),
				sqlString(row.xxHash),
				sqlString(row.name),
				sqlString(row.imageUrl),
				sqlNumber(row.validationTimeAuthor),
				sqlNumber(row.validationTimeGold),
				sqlNumber(row.validationTimeSilver),
				sqlNumber(row.validationTimeBronze),
				sqlNumber(row.amountCheckpoints),
				sqlNumber(row.amountFinishes),
				sqlNumber(row.amountBlocks),
				sqlNumber(row.typeGround),
				sqlNumber(row.typeSkybox),
				sqlNumber(row.format),
				sqlJson(row.blocks),
			].join(', '),
		)
		.map((row) => `\t\t(${row})`)
		.join(',\n')
}

function adventureDataCte(rows: AdventureMigrationRow[]): string {
	return `adventure_data(
\tuid,
\txx_hash,
\tname,
\timage_url,
\tvalidation_time_author,
\tvalidation_time_gold,
\tvalidation_time_silver,
\tvalidation_time_bronze,
\tamount_checkpoints,
\tamount_finishes,
\tamount_blocks,
\ttype_ground,
\ttype_skybox,
\tformat,
\tblocks
) AS (
\tVALUES
${valuesList(rows)}
)`
}

export function generateAdventureMigrationSql(rows: AdventureMigrationRow[]): string {
	if (rows.length === 0) {
		throw new Error('Cannot generate adventure migration without rows')
	}

	return `WITH ${adventureDataCte(rows)},
matched_levels AS (
\tSELECT
\t\t"level"."id" AS id_level,
\t\tadventure_data.*
\tFROM adventure_data
\tINNER JOIN "level" ON "level"."hash" = adventure_data.uid
\tWHERE "level"."xx_hash" IS NULL
),
updated_levels AS (
\tUPDATE "level"
\tSET
\t\t"xx_hash" = matched_levels.xx_hash,
\t\t"adventure" = TRUE,
\t\t"date_updated" = now()
\tFROM matched_levels
\tWHERE "level"."id" = matched_levels.id_level
\tRETURNING matched_levels.*
),
inserted_level_items AS (
\tINSERT INTO "level_item" (
\t"id_level",
\t"workshop_id",
\t"author_id",
\t"name",
\t"image_url",
\t"file_author",
\t"file_uid",
\t"validation_time_author",
\t"validation_time_gold",
\t"validation_time_silver",
\t"validation_time_bronze",
\t"deleted",
\t"created_at",
\t"updated_at",
\t"date_created",
\t"date_updated"
)
\tSELECT
\t\tupdated_levels.id_level,
\t\t${adventureWorkshopId}::bigint,
\t\t${adventureAuthorId}::bigint,
\t\tupdated_levels.name,
\t\tupdated_levels.image_url,
\t\t'Yannic',
\t\tupdated_levels.uid,
\t\tupdated_levels.validation_time_author,
\t\tupdated_levels.validation_time_gold,
\t\tupdated_levels.validation_time_silver,
\t\tupdated_levels.validation_time_bronze,
\t\tFALSE,
\t\tnow(),
\t\tnow(),
\t\tnow(),
\t\tnow()
\tFROM updated_levels
\tWHERE NOT EXISTS (
\t\tSELECT 1
\t\tFROM "level_item"
\t\tWHERE "level_item"."id_level" = updated_levels.id_level
\t\t\tAND "level_item"."file_uid" = updated_levels.uid
\t)
\tRETURNING 1
)
INSERT INTO "level_metadata" (
\t"id_level",
\t"amount_checkpoints",
\t"amount_finishes",
\t"amount_blocks",
\t"type_ground",
\t"type_skybox",
\t"format",
\t"blocks",
\t"date_created",
\t"date_updated"
)
SELECT
\tupdated_levels.id_level,
\tupdated_levels.amount_checkpoints,
\tupdated_levels.amount_finishes,
\tupdated_levels.amount_blocks,
\tupdated_levels.type_ground,
\tupdated_levels.type_skybox,
\tupdated_levels.format,
\tupdated_levels.blocks,
\tnow(),
\tnow()
FROM updated_levels
WHERE NOT EXISTS (
\tSELECT 1
\tFROM "level_metadata"
\tWHERE "level_metadata"."id_level" = updated_levels.id_level
);
`
}

async function countAdventureFiles(adventureRoot: string): Promise<number> {
	const entries = await readdir(adventureRoot, { withFileTypes: true, recursive: true })
	return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.zeeplevel')).length
}

function validateUnique<T>(rows: T[], key: (row: T) => string, label: string) {
	const seen = new Set<string>()
	for (const row of rows) {
		const value = key(row)
		if (seen.has(value)) {
			throw new Error(`Duplicate ${label}: ${value}`)
		}
		seen.add(value)
	}
}

export async function loadAdventureMigrationRows(
	adventureRoot: string,
): Promise<AdventureMigrationRow[]> {
	const mapPath = join(adventureRoot, 'map.csv')
	const entries = parseAdventureMap(await readFile(mapPath, 'utf8'))
	const fileCount = await countAdventureFiles(adventureRoot)
	if (entries.length !== fileCount) {
		throw new Error(
			`Adventure map has ${entries.length} rows but ${fileCount} .zeeplevel files exist`,
		)
	}

	validateUnique(entries, (entry) => entry.uid, 'adventure UID')
	validateUnique(entries, (entry) => entry.levelName, 'adventure level name')

	const rows: AdventureMigrationRow[] = []
	for (const entry of entries) {
		const series = getAdventureSeries(entry.levelName)
		const filePath = join(adventureRoot, series, `${entry.levelName}.zeeplevel`)
		if (!existsSync(filePath)) {
			throw new Error(`Missing adventure level file: ${relative(adventureRoot, filePath)}`)
		}

		const parsed = parseJsonLevelV2(await readFile(filePath, 'utf8'), true)
		if (!/^[0-9A-F]{32}$/.test(parsed.hash)) {
			throw new Error(`Parsed adventure level ${entry.levelName} has invalid XXH128 hash`)
		}

		const name = getAdventureShortName(entry.levelName)
		rows.push({
			uid: entry.uid,
			xxHash: parsed.hash,
			series,
			name,
			imageUrl: getAdventureImageUrl(series, name),
			validationTimeAuthor: parsed.validationTimeAuthor,
			validationTimeGold: parsed.validationTimeGold,
			validationTimeSilver: parsed.validationTimeSilver,
			validationTimeBronze: parsed.validationTimeBronze,
			amountCheckpoints: parsed.amountCheckpoints,
			amountFinishes: parsed.amountFinishes,
			amountBlocks: parsed.amountBlocks,
			typeGround: parsed.typeGround,
			typeSkybox: parsed.typeSkybox,
			format: parsed.format,
			blocks: parsed.blocks,
		})
	}

	validateUnique(rows, (row) => row.xxHash, 'adventure XXH128')
	return rows
}

async function nextMigrationPrefix(migrationsFolder: string): Promise<string> {
	const entries = await readdir(migrationsFolder, { withFileTypes: true })
	const max = entries
		.filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/.test(entry.name))
		.map((entry) => Number(entry.name.slice(0, 4)))
		.reduce((highest, current) => Math.max(highest, current), 0)
	return String(max + 1).padStart(4, '0')
}

async function updateDrizzleJournal(migrationsFolder: string, prefix: string, tag: string) {
	const journalPath = join(migrationsFolder, 'meta', '_journal.json')
	const journal = JSON.parse(await readFile(journalPath, 'utf8')) as DrizzleJournal
	const index = Number(prefix)
	const journalTag = `${prefix}_${tag}`
	if (journal.entries.some((entry) => entry.tag === journalTag)) {
		throw new Error(`Drizzle journal already contains ${journalTag}`)
	}

	journal.entries.push({
		idx: index,
		version: journal.version,
		when: Date.now(),
		tag: journalTag,
		breakpoints: true,
	})

	await writeFile(journalPath, `${JSON.stringify(journal, null, '\t')}\n`)
}

async function copyLatestSnapshot(migrationsFolder: string, prefix: string) {
	const metaFolder = join(migrationsFolder, 'meta')
	const snapshots = (await readdir(metaFolder, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && /^\d{4}_snapshot\.json$/.test(entry.name))
		.map((entry) => entry.name)
		.sort()
	const latestSnapshot = snapshots.at(-1)
	if (!latestSnapshot) {
		throw new Error('Unable to find latest Drizzle snapshot')
	}

	await copyFile(join(metaFolder, latestSnapshot), join(metaFolder, `${prefix}_snapshot.json`))
}

export async function createAdventureLevelMigration({
	adventureRoot,
	migrationsFolder,
	tag = 'adventure_level_backfill',
	dryRun = false,
	allowEmpty = false,
}: CreateMigrationOptions): Promise<{ path: string; rows: number; written: boolean }> {
	const rows = await loadAdventureMigrationRows(adventureRoot)
	if (rows.length === 0 && !allowEmpty) {
		throw new Error('No adventure levels found')
	}

	const prefix = await nextMigrationPrefix(migrationsFolder)
	const migrationPath = join(migrationsFolder, `${prefix}_${tag}.sql`)
	if (dryRun) {
		return { path: migrationPath, rows: rows.length, written: false }
	}

	await mkdir(dirname(migrationPath), { recursive: true })
	await writeFile(migrationPath, generateAdventureMigrationSql(rows))
	await copyLatestSnapshot(migrationsFolder, prefix)
	await updateDrizzleJournal(migrationsFolder, prefix, tag)
	return { path: migrationPath, rows: rows.length, written: true }
}

function parseArgs(argv: string[]) {
	const dryRun = argv.includes('--dry-run')
	const allowEmpty = argv.includes('--allow-empty')
	const tagArg = argv.find((arg) => arg.startsWith('--tag='))
	return {
		dryRun,
		allowEmpty,
		tag: tagArg?.slice('--tag='.length),
	}
}

if (import.meta.main) {
	const repoRoot = join(import.meta.dir, '..', '..', '..', '..')
	const { dryRun, allowEmpty, tag } = parseArgs(Bun.argv.slice(2))
	const result = await createAdventureLevelMigration({
		adventureRoot: join(repoRoot, 'data', 'adventureLevels'),
		migrationsFolder: join(repoRoot, 'packages', 'database', 'drizzle'),
		tag,
		dryRun,
		allowEmpty,
	})

	console.info(
		`${result.written ? 'Wrote' : 'Dry run'} ${basename(result.path)} with ${result.rows} adventure levels`,
	)
}
