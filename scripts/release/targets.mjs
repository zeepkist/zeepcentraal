const rustTargets = {
	'zc-server': {
		crate: 'server',
		dependencies: ['server', 'jobs', 'workshop', 'database', 'core', 'telemetry'],
		binary: 'zeepcentraal-server',
		dockerfile: 'Dockerfile.server',
	},
	'zc-jobs': {
		crate: 'jobs',
		dependencies: ['jobs', 'workshop', 'database', 'core', 'telemetry'],
		binary: 'zeepcentraal-jobs',
		dockerfile: 'Dockerfile.jobs',
	},
	'zc-migrate': {
		crate: 'migrate',
		dependencies: ['migrate', 'database', 'core', 'telemetry'],
		binary: 'zeepcentraal-migrate',
		dockerfile: 'Dockerfile.migrate',
	},
	'zc-lobby-host': {
		crate: 'lobby-host',
		dependencies: ['lobby-host', 'database', 'core', 'telemetry'],
		binary: 'zeepcentraal-lobby-host',
		dockerfile: 'Dockerfile.lobby-host',
	},
	'zc-discord': {
		crate: 'discord',
		dependencies: ['discord', 'core', 'telemetry'],
		binary: 'zeepcentraal-discord',
		dockerfile: 'Dockerfile.discord',
	},
	'zc-inspector-zeep': {
		crate: 'inspector-zeep',
		dependencies: ['inspector-zeep', 'workshop', 'database', 'core', 'telemetry'],
		binary: 'zeepcentraal-inspector-zeep',
		dockerfile: 'Dockerfile.inspector-zeep',
	},
	'zc-import-zsl': {
		crate: 'import-zsl',
		dependencies: ['import-zsl', 'database', 'core', 'telemetry'],
		binary: 'zeepcentraal-import-zsl',
		dockerfile: 'Dockerfile.zsl',
		cloneSuperLeague: true,
	},
}

function affects(target, path) {
	if (target === 'ts') {
		return /^(packages\/(web|postgraphile|core|database|graphql|telemetry)\/|bun\.lock$|package\.json$|Dockerfile\.(web|postgraphile)$)/.test(
			path,
		)
	}
	const service = rustTargets[target]
	if (!service) throw new Error(`Unknown release target: ${target}`)
	return (
		service.dependencies.some((name) => path.startsWith(`crates/${name}/`)) ||
		(service.dependencies.includes('database') &&
			path.startsWith('packages/database/drizzle/')) ||
		path === service.dockerfile ||
		[
			'Cargo.toml',
			'Cargo.lock',
			'rust-toolchain.toml',
			'.github/actions/build-docker-image/action.yml',
			'.github/workflows/deploy.yml',
		].includes(path)
	)
}

export { affects, rustTargets }
