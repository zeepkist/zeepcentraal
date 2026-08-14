import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	createIPX,
	createIPXFetchHandler,
	type HTTPStorageOptions,
	type IPXOptions,
	ipxFSStorage,
	ipxHttpStorage,
	type NodeFSSOptions,
	parseIPXURL,
} from 'ipx'

export interface IpxRuntimeOptions extends Omit<IPXOptions, 'httpStorage' | 'storage'> {
	baseURL?: string
	fs?: false | NodeFSSOptions
	http?: false | HTTPStorageOptions
}

export function stripIpxBaseURL(url: string, baseURL: string): string {
	const parsedURL = new URL(url)
	let pathname = parsedURL.pathname

	if (baseURL && (pathname === baseURL || pathname.startsWith(`${baseURL}/`))) {
		pathname = pathname.slice(baseURL.length) || '/'
	}

	return parsedURL.origin + pathname + parsedURL.search
}

export function resolveIpxFsDirectories(dir: string | string[], moduleURL: string): string[] {
	return (Array.isArray(dir) ? dir : [dir]).map((path) =>
		isAbsolute(path) ? path : fileURLToPath(new URL(path, moduleURL)),
	)
}

export function createIpxWebHandler(options: IpxRuntimeOptions, moduleURL = import.meta.url) {
	const { baseURL: configuredBaseURL, fs, http, ...ipxOptions } = options
	const fsOptions = fs || undefined
	const httpOptions = http || undefined
	const fsStorage = fsOptions?.dir
		? ipxFSStorage({
				...fsOptions,
				dir: resolveIpxFsDirectories(fsOptions.dir, moduleURL),
			})
		: undefined
	const httpStorage = httpOptions?.domains ? ipxHttpStorage(httpOptions) : undefined
	const storage = fsStorage ?? httpStorage

	if (!storage) {
		throw new Error('IPX storage is not configured!')
	}

	const ipx = createIPX({
		...ipxOptions,
		storage,
		httpStorage,
	})
	const baseURL = (configuredBaseURL || '/_ipx').replace(/\/+$/, '')

	return createIPXFetchHandler(ipx, {
		parseURL: (url) => parseIPXURL(stripIpxBaseURL(url, baseURL)),
	})
}
