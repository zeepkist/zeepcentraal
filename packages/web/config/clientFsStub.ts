export const CLIENT_FS_STUB_ID = '\0virtual:zeepcentraal-client-fs-stub'
export const CLIENT_FS_STUB_SOURCE = [
	'export const readFile = undefined',
	'export const readFileSync = undefined',
	'export const promises = undefined',
	'export default Object.freeze({})',
].join('\n')

type ClientFsStubPlugin = {
	name: string
	enforce: 'pre'
	resolveId: (
		source: string,
		importer: string | undefined,
		options: { ssr?: boolean },
	) => string | null
	load: (id: string) => string | null
}

export function resolveClientFsStubId(source: string, ssr: boolean | undefined) {
	if (ssr || (source !== 'fs' && source !== 'node:fs')) return null
	return CLIENT_FS_STUB_ID
}

export function clientFsStub(): ClientFsStubPlugin {
	return {
		name: 'zeepcentraal-client-fs-stub',
		enforce: 'pre',
		resolveId(source, _importer, options) {
			return resolveClientFsStubId(source, options.ssr)
		},
		load(id) {
			if (id !== CLIENT_FS_STUB_ID) return null
			return CLIENT_FS_STUB_SOURCE
		},
	}
}
