# Vue Vapor on Nuxt 4.6

Nuxt enables Vapor interop with `vue.vapor: true`. Vue runtime and compiler packages
share the exact `3.6.0-rc.11` version through root overrides. Keep the three-day
release-age policy when updating this prerelease.
Nuxt's `pinia` alias and Vite deduplication keep Bun's isolated peer variants from
creating separate Pinia injection symbols during SSR.

Use `<script setup vapor lang="ts">` for compatible components. Bind translations
through `const { t } = useAppI18n()` and call `t(...)` in templates. The composable
returns Nuxt's global composer. Vue I18n's `useI18n()` requires a VDOM instance,
and Vapor does not support `app.config.globalProperties`. Register Nuxt composables
before awaiting data. Import template helpers explicitly from `#imports`;
production Vapor templates cannot resolve auto-imports through instance state.
Dependent calls in `VoteResults` use the captured Nuxt app's `runWithContext`.

VDOM boundaries:

- `app.vue`, `error.vue`, and the default layout retain the application shell.
- `OgImage/*.takumi.vue` and `Og*.vue` retain Takumi's VDOM rendering input.
- `pages/adventure/index.vue` and `pages/totd.vue` are redirect-only pages. Nuxt's
  early-return transform produces invalid code for template-free Vapor redirects.
- `pages/records/me.vue` retains its early authentication redirect before setup.
- `*.client.vue` components retain VDOM. Nuxt 4.6.0 wraps their setup results with
  `createClientOnly`, which expects VDOM render functions or setup state, not Vapor
  blocks. This includes playlist controls and the ghost verification/viewer boundaries.
- Reka trigger owners retain VDOM because `PrimitiveSlot` inspects and clones VNodes.
  Boundaries: `AppSidebar`, `AuthMenu`, `LocaleSwitcher`, `TournamentPlaylistActions`,
  `GhostPerformanceSettings`, `RecordAirControlAnalysis`, `RecordEventTimeline`,
  `RecordPointsHeader`, `RecordPointValue`, and `ContentCodeGroup`. Vapor slots
  otherwise lose trigger events, including locale/account dropdown activation.

`guardMdcVdomTransform` keeps MDC's slot compiler transform on VDOM. The transform
expects `context.nodeTransforms`, which Vapor does not provide. Keep components
using `MDCSlot` or `mdc-unwrap` on VDOM until MDC supports Vapor.

Server routes import portable handlers and helpers from `nuxt/server`. Sitemap
integration and telemetry retain explicit H3 imports for third-party event APIs.
Nitro cache and lifecycle helpers come from `nitropack/runtime`.

Nuxt 4.6.0 also needs `NUXT_RUNTIME_INLINE` on Windows. Nitro's string matcher
misses backslash paths and otherwise loads placeholder renderer manifests.
The separator-independent matcher preserves normal Linux builds. Upstream issue:
https://github.com/nuxt/nuxt/issues/36467.

Validate compiled output and browser behavior. A `vapor` attribute alone does not
prove that the component uses Vapor or hydrates correctly.
