interface XxHashAddon {
	XXHash128: {
		hash(content: Buffer): Buffer
	}
}

function loadXxHashAddon(): XxHashAddon {
	const platform = process.platform
	const architecture = process.arch

	if (platform === 'linux' && architecture === 'x64') {
		return require('xxhash-addon/prebuilds/linux-x64/addon.napi.glibc.node') as XxHashAddon
	}
	if (platform === 'linux' && architecture === 'arm64') {
		return require('xxhash-addon/prebuilds/linux-arm64/addon.napi.glibc.node') as XxHashAddon
	}
	if (platform === 'win32' && architecture === 'x64') {
		return require('xxhash-addon/prebuilds/win32-x64/addon.napi.node') as XxHashAddon
	}
	if (platform === 'win32' && architecture === 'arm64') {
		return require('xxhash-addon/prebuilds/win32-arm64/addon.napi.node') as XxHashAddon
	}
	if (platform === 'darwin' && architecture === 'x64') {
		return require('xxhash-addon/prebuilds/darwin-x64/addon.napi.node') as XxHashAddon
	}
	if (platform === 'darwin' && architecture === 'arm64') {
		return require('xxhash-addon/prebuilds/darwin-arm64/addon.napi.node') as XxHashAddon
	}

	throw new Error(`Unsupported xxhash-addon platform: ${platform}/${architecture}`)
}

const { XXHash128 } = loadXxHashAddon()

export function xxHash128Hex(content: string): string {
	return XXHash128.hash(Buffer.from(content, 'utf8')).toString('hex').toUpperCase()
}
