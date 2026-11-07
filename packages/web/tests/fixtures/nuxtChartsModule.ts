import { mock } from 'bun:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type ImportSource = { from: string; type?: boolean; imports: string[] }
type Component = { name: string; global: boolean }

const sources: ImportSource[] = []
const components: Component[] = []
const nuxt = {
	options: { alias: {} as Record<string, string>, css: [] as string[] },
	hook() {},
}
const options = {
	prefix: '',
	autoImports: true,
	include: ['LineChart', 'BarChart', 'DonutChart'],
	global: false,
}

// Capture the module's public registrations without starting a second Nuxt build.
mock.module('@nuxt/kit', () => ({
	defineNuxtModule: (definition: unknown) => definition,
	createResolver: (base: string) => ({
		resolve: (relative: string) => fileURLToPath(new URL(relative, base)).replaceAll('\\', '/'),
	}),
	addImportsSources: (source: ImportSource) => sources.push(source),
	addComponent: (component: Component) => components.push(component),
	useLogger: () => ({ warn() {} }),
	hasNuxtModule: () => false,
	addPluginTemplate() {},
	addTypeTemplate() {},
}))

const { default: chartModule } = (await import('nuxt-charts')) as unknown as {
	default: { setup(moduleOptions: typeof options, instance: typeof nuxt): Promise<void> }
}
await chartModule.setup(options, nuxt)

for (const source of sources.filter((source) => !source.type)) {
	assert.ok(isAbsolute(source.from), `Unresolved chart import: ${source.from}`)
	assert.ok(!source.from.includes('\\'), `Unescaped chart import path: ${source.from}`)
	assert.ok(
		existsSync(Bun.resolveSync(source.from, import.meta.dir)),
		`Missing chart entry: ${source.from}`,
	)
}
const enumSource = sources.find((source) => source.imports.includes('Orientation'))
assert.ok(enumSource)
const enums = await import(pathToFileURL(Bun.resolveSync(enumSource.from, import.meta.dir)).href)
assert.equal(enums.Orientation.Horizontal, 'horizontal')
assert.deepEqual(components.map(({ name }) => name).sort(), [...options.include].sort())
assert.ok(components.every(({ global }) => !global))
assert.deepEqual(nuxt.options.alias, {})
