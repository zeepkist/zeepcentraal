import { readFileSync, writeFileSync } from 'node:fs'

const crates = {
	'zc-server': 'server',
	'zc-jobs': 'jobs',
	'zc-migrate': 'migrate',
	'zc-lobby-host': 'lobby-host',
	'zc-discord': 'discord',
	'zc-inspector-zeep': 'inspector-zeep',
	'zc-import-zsl': 'import-zsl',
}

const planPath = process.argv[2]
if (!planPath) throw new Error('Usage: node scripts/release/stamp.mjs PLAN_PATH')
const plan = JSON.parse(readFileSync(planPath, 'utf8'))
let lock = readFileSync('Cargo.lock', 'utf8')

for (const release of plan.releases) {
	const crate = crates[release.target]
	if (!crate) continue
	if (!/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error(`Invalid version: ${release.version}`)
	const manifestPath = `crates/${crate}/Cargo.toml`
	const manifest = readFileSync(manifestPath, 'utf8')
	const baseline = 'version = "3.0.0"'
	if (!manifest.includes(baseline)) throw new Error(`Missing baseline version in ${manifestPath}`)
	writeFileSync(manifestPath, manifest.replace(baseline, `version = "${release.version}"`))
	const lockPattern = new RegExp(`(\\[\\[package\\]\\]\\nname = "${release.target}"\\nversion = ")3\\.0\\.0("\\n)`)
	if (!lockPattern.test(lock)) throw new Error(`Missing baseline lock entry for ${release.target}`)
	lock = lock.replace(lockPattern, (_match, before, after) => `${before}${release.version}${after}`)
}

writeFileSync('Cargo.lock', lock)
