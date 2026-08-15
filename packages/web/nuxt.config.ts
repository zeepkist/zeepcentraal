import { fileURLToPath } from 'node:url'
import { ADVENTURE_SERIES } from './app/utils/adventureSeries'
import { getBuildAssetsDir } from './config/buildAssets'
import { clientFsStub } from './config/clientFsStub'
import { createNitroCacheStorageOptions } from './config/nitroCache'
import { bundledUiIcons, uiIcons } from './config/uiIcons'

const ogImageModuleUrl = import.meta.resolve('nuxt-og-image')
const ogImageUrlBuilderPath = fileURLToPath(
	new URL('./runtime/shared/urlEncoding.js', ogImageModuleUrl),
)

const productionGraphqlHttpUrl = 'https://graphql.zeepki.st'
const productionGraphqlWsUrl = 'wss://graphql.zeepki.st'
const productionBackendUrl = 'https://backend.zeepki.st'

export default defineNuxtConfig({
	alias: {
		'#records-og-image-url-builder': ogImageUrlBuilderPath,
	},
	compatibilityDate: '2026-07-25',
	debug: process.env.NUXT_DEBUG === 'true',
	devtools: { enabled: process.env.NUXT_ENABLE_DEVTOOLS === 'true' },
	ssr: true,
	srcDir: 'app',
	future: {
		compatibilityVersion: 5,
		typescriptBundlerResolution: true,
	},
	experimental: {
		watcher: 'builder',
		emitRouteChunkError: 'automatic-immediate',
		crossOriginPrefetch: true,
		writeEarlyHints: true,
		typedPages: true,
		buildCache: true,
		viewTransition: true,
	},
	appConfig: {
		ui: {
			colors: {
				primary: 'yellow',
				secondary: 'secondary',
				success: 'green',
				info: 'teal',
				warning: 'orange',
				error: 'red',
				neutral: 'warm-neutral',
			},
			icons: uiIcons,
		},
	},
	css: ['~/assets/css/tailwind.css'],
	components: [
		{
			path: '~/components',
			pathPrefix: false,
		},
	],
	modules: [
		'@nuxt/ui',
		'@nuxtjs/i18n',
		'@nuxtjs/seo',
		'@nuxt/content',
		'@nuxt/image',
		'@pinia/nuxt',
		'nuxt-charts',
	],
	content: {
		experimental: {
			sqliteConnector: 'native',
		},
		database: {
			type: 'sqlite',
			filename: ':memory:',
		},
		build: {
			markdown: {
				highlight: {
					theme: {
						default: 'github-dark',
						dark: 'github-dark',
						light: 'github-light',
					},
					langs: ['graphql', 'json', 'python'],
				},
			},
		},
	},
	typescript: {
		strict: true,
		typeCheck: process.env.NUXT_ENABLE_TYPECHECK === 'true',
		tsConfig: {
			compilerOptions: {
				noUncheckedIndexedAccess: true,
			},
		},
	},
	runtimeConfig: {
		blockMeshCorpusPath: process.env.NUXT_BLOCK_MESH_CORPUS_PATH ?? '',
		blockMeshCorpusToken: process.env.NUXT_BLOCK_MESH_CORPUS_TOKEN ?? '',
		githubToken: process.env.NUXT_GITHUB_TOKEN ?? '',
		modioApiKey: process.env.NUXT_MODIO_API_KEY ?? '',
		modioApiEndpoint: process.env.NUXT_MODIO_API_ENDPOINT ?? 'https://api.mod.io/',
		public: {
			graphqlHttpUrl: process.env.NUXT_PUBLIC_GRAPHQL_HTTP_URL ?? productionGraphqlHttpUrl,
			graphqlWsUrl: process.env.NUXT_PUBLIC_GRAPHQL_WS_URL ?? productionGraphqlWsUrl,
			backendUrl: process.env.NUXT_PUBLIC_BACKEND_URL ?? productionBackendUrl,
			ghostCdnOrigins: process.env.NUXT_PUBLIC_GHOST_CDN_ORIGINS ?? 'https://cdn.zeepki.st',
		},
	},
	image: {
		provider: 'none',
	},
	icon: {
		clientBundle: {
			icons: bundledUiIcons,
		},
	},
	routeRules: {
		'/auth/callback': { redirect: { to: '/?auth=callback', statusCode: 302 } },
		'/adventure': { sitemap: false },
		'/cosmetic/**': { sitemap: false },
		'/cosmetics': { sitemap: false },
		'/records/me': { robots: false, sitemap: false },
		'/settings': { robots: false, sitemap: false },
		'/settings/**': { robots: false, sitemap: false },
		'/sitemaps/**': { swr: 600 },
		'/totd': { sitemap: false },
	},
	vite: {
		plugins: [clientFsStub()],
		optimizeDeps: {
			include: [
				'@nuxt/content > slugify',
				'@tabler/icons-vue',
				'@unhead/schema-org/vue',
				'@urql/vue',
			],
		},
	},
	nitro: {
		preset: 'bun',
		compressPublicAssets: true,
		storage: {
			cache: createNitroCacheStorageOptions(),
		},
		esbuild: {
			options: {
				target: 'esnext',
			},
		},
	},
	colorMode: {
		preference: 'dark',
		fallback: 'dark',
		classSuffix: '',
		storage: 'cookie',
		storageKey: 'colour_mode',
	},
	fonts: {
		families: [
			{
				name: 'DINish',
				src: '/fonts/DINish.woff2',
				style: 'normal',
				weight: '300 900',
				global: true,
			},
		],
		providers: {
			adobe: false,
			bunny: false,
			fontshare: false,
			fontsource: false,
			google: false,
			googleicons: false,
			npm: false,
		},
	},
	i18n: {
		baseUrl: 'https://zeepki.st',
		defaultLocale: 'en',
		strategy: 'no_prefix',
		langDir: '../i18n/locales',
		locales: [
			{
				code: 'en',
				language: 'en-GB',
				name: 'English',
				files: ['en.json'],
				isCatchallLocale: true,
			},
			/*
			{
				code: 'de',
				language: 'de-DE',
				name: 'Deutsch',
				files: ['en.json', 'de.json'],
			},
			*/
			//{ code: 'ja', language: 'ja-JP', name: '日本語', files: ['en.json'] },
			//{ code: 'nl', language: 'nl-NL', name: 'Nederlands', files: ['en.json'] },
			//{ code: 'no', language: 'no-NO', name: 'Norsk', files: ['en.json'] },
		],
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: 'i18n_redirected',
			redirectOn: 'root',
			alwaysRedirect: false,
		},
	},
	site: {
		url: 'https://zeepki.st',
		name: 'ZeepCentraal',
	},
	seo: {
		enabled: true,
	},
	schemaOrg: {
		enabled: true,
		identity: {
			type: 'Organization',
			name: 'ZeepCentraal',
			url: 'https://zeepki.st',
		},
	},
	ogImage: {
		enabled: true,
		security: {
			//restrictRuntimeImagesToOrigin: true,
		},
	},
	linkChecker: {
		enabled: false,
	},
	robots: {
		enabled: true,
		disallow: ['/records/me', '/settings'],
	},
	sitemap: {
		defaults: {
			changefreq: 'daily',
			priority: 0.7,
		},
		sitemaps: {
			pages: {
				includeAppSources: true,
				urls: ADVENTURE_SERIES.map((series) => `/adventure/${series.slug}`),
			},
		},
	},
	app: {
		buildAssetsDir: getBuildAssetsDir(process.env.NUXT_BUILD_REVISION),
		head: {
			title: 'ZeepCentraal',
			htmlAttrs: { lang: 'en' },
			link: [
				{
					rel: 'preload',
					href: '/fonts/DINish.woff2',
					as: 'font',
					type: 'font/woff2',
					crossorigin: 'anonymous',
				},
				//{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
				{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' },
				{ rel: 'icon', type: 'image/png', href: '/favicon-16x16.png' },
				{ rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#5bbad5' },
				{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
				{ rel: 'manifest', href: '/site.webmanifest' },
				{ rel: 'shortcut icon', href: '/favicon.ico' },
			],
		},
	},
})
