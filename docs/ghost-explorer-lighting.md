# Ghost Explorer lighting

Material mode uses authored Unity lighting and linear HDR rendering. AgX exposure stays at 1.
Final OutputPass performs tone mapping and sRGB conversion once. Physics colours retain previous lighting.
Shared viewer covers records, levels, and tournaments.

Protected source manifest is version 5, corpus version 6, and level bundle version 5.
Previous manifest 4, corpus 5, and level bundle 4 remain readable with safe defaults.
Ghost model bundle stays version 3. No raw exports or public asset endpoints are added.

Unity exports supply nested light transforms, controller defaults, saved options, all 15 sky profiles,
and authored material emission. Saved logic-light state renders without game logic simulation.
White materials do not enter bloom unless their material explicitly emits light.

## Quality budgets

Exposure, material colours, and authored light intensity stay identical across presets.
Selection favours visible light contribution and retains nearby selections with hysteresis.

- Performance: 8 local lights, 1024px sun shadow, no local shadows, GTAO, bloom, or beams.
- Balanced: 16 local lights, 2048px sun shadow, 2 local shadow faces, half-resolution GTAO,
  quarter-resolution bloom and beams, 16 ray samples.
- Quality: 32 local lights, 4096px sun shadow, 8 local shadow faces, full-resolution GTAO,
  half-resolution bloom and beams, 32 ray samples.

Spot shadows cost 1 face. Point shadows cost 6 faces. Static shadows refresh after geometry,
selected lights, or camera shadow coverage changes. Sun coverage uses texel snapping and distance limits.
Glass, translucent ghosts, trails, labels, and grid do not contribute opaque depth or contact shading.
Glass and ghosts never cast opaque shadows. Beams use scene depth and selected local shadow maps.

Reflection captures start from authored ambient lighting each time. Captured environments never feed
subsequent captures. SSR blends over separately captured environment specular rather than adding both.

## Migration and rollout

**No migrations, production backfills, corpus publication, or deployments run during implementation.**
Database migrations use Rust Diesel only. Archived Drizzle migration history remains unchanged.

1. Deploy and apply Diesel migrations through existing Rust migration release:
   `20261002020000_level_environment` adds nullable `level_metadata.environment` JSONB;
   `20261002020100_adventure_environment_backfill` fills 120 adventure environments from source exports.
   Backfill updates only environment and metadata timestamp. Level hashes and block data remain unchanged.
2. Deploy ingestion changes and restart PostGraphile so additive field becomes available.
   Refresh GraphQL schema from migrated environment and regenerate types while preserving unrelated document changes.
3. Publish private corpus version 6 before deploying viewer. Set `NUXT_BLOCK_MESH_CORPUS_PATH`
   to new private location. Keep existing authentication and private corpus token configuration.
4. Deploy viewer. Built-in profile handles missing custom metadata during workshop backfill.
5. Enqueue existing `syncWorkshopCatalog` with `{"all":true}` through authenticated job trigger.
   Do not add another ingestion or backfill path.

Adventure backfill generator only writes SQL. This command never opens a database:

```powershell
cargo run -p zc-migrate -- generate-adventure-environment data/adventureLevels crates/database/migrations/20261002020100_adventure_environment_backfill/up.sql
```

Generate corpus from original Unity GameObject, Mesh, MonoBehaviour, Material, Shader, and
Scripts/Zeepkist exports. Generator reads GameScene and SkyboxManager from same export tree.
Pass existing GLB mesh and ghost model paths through `generate-block-mesh-manifest.ts` options.
Keep generated corpus private. Local review corpus contains 2515 blocks, 4781 meshes,
59 light definitions across 54 block types, and 15 sky profiles.

## Validation

Unit coverage checks CSV/JSON options, fractional brightness, mirrored transforms, spotlight scaling,
disabled lamps, saved logic state, custom environments, unchanged hashes, emission, bundle compatibility,
cache identity, repeated captures, quality budgets, shadow stability, and resource disposal.

Browser harness exercises same lighting, material, reflection, and postprocessing utilities as viewer.
Deterministic fixtures cover white surfaces, ice, glass, coloured lights, night, occlusion, and beams.
Named fixtures use source files in `packages/core/testdata/legacy-hash`:
Airborne Embers, A Colourful Valley, and Aerotaro. Camera framing selects nearby start geometry,
excluding distant decorative outliers from review framing.

Run all presets and both cameras:

```powershell
cd packages/web
$env:GHOST_LIGHTING_GPU='1'
node node_modules/@playwright/test/cli.js test --config playwright.lighting.config.ts
```

Set `GHOST_LIGHTING_CORPUS` for private corpus path outside default local Windows checkout.
Set `GHOST_LIGHTING_FIXTURES_DIR` to override source fixture directory.
Windows uses installed Chrome; `PLAYWRIGHT_CHANNEL` overrides browser channel.
Without `GHOST_LIGHTING_GPU=1`, harness uses SwiftShader. Browser captures remain local test artifacts.

Acceptance: white surfaces retain detail; material hues remain recognisable; shadows remain stable;
beams obey occlusion; repeated reflection capture does not increase brightness.
Browser validation also covers resize, renderer replacement, context restoration, and physics restoration.
PostgreSQL integration tests require disposable local database and remain ignored without that environment.
