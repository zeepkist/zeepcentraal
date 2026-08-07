import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repositoryFile = (path: string) =>
	readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8')

const rootPackage = JSON.parse(repositoryFile('package.json')) as {
	scripts: Record<string, string>
	devDependencies: Record<string, string>
}
const webTsconfig = JSON.parse(
	readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8'),
) as {
	compilerOptions: Record<string, unknown>
}
const bunfig = repositoryFile('bunfig.toml')
const preCommit = repositoryFile('.githooks/pre-commit')
const workflows = [
	repositoryFile('.github/workflows/pr-validate.yml'),
	repositoryFile('.github/workflows/deploy.yml'),
]

describe('repository quality gates', () => {
	it('keeps Golar route inference scoped to the web project', () => {
		expect(webTsconfig.compilerOptions.rootDir).toBe('.')
	})

	it('isolates web Vitest files from the root Bun test runner', () => {
		expect(bunfig).toContain('pathIgnorePatterns = ["packages/web/**"]')
		expect(rootPackage.scripts.test).toBe('bun test --isolate')
		expect(rootPackage.scripts['test:web']).toBe('bun --cwd=packages/web run test')
	})

	it('runs root and web checks in both CI workflows', () => {
		for (const workflow of workflows) {
			expect(workflow).toContain('run: bun run typecheck')
			expect(workflow).toContain('run: bun run typecheck:web')
			expect(workflow).not.toContain('run: bun --bun run typecheck')
			expect(workflow).toContain('run: bun --bun run test')
			expect(workflow).toContain('run: bun --bun run test:web')
		}
	})

	it('configures native Git hooks without Husky', () => {
		expect(rootPackage.scripts.prepare).toContain('git config --local core.hooksPath .githooks')
		expect(rootPackage.devDependencies).not.toHaveProperty('husky')
		expect(preCommit).toMatch(/^#!\/bin\/sh\nset -e\n/)
	})

	it('runs web typechecking and both test suites from native pre-commit hook', () => {
		expect(preCommit).toContain('bun run typecheck\nbun run typecheck:web')
		expect(preCommit).toContain('bun run test &')
		expect(preCommit).toContain('bun run test:web &')
		expect(preCommit).toContain('wait "$root_test_pid"')
		expect(preCommit).toContain('wait "$web_test_pid"')
		expect(preCommit).toContain('[ "$root_test_status" -ne 0 ]')
		expect(preCommit).toContain('[ "$web_test_status" -ne 0 ]')
	})
})
