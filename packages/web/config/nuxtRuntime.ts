// Nuxt 4.6.0's string matcher misses backslash paths on Windows, leaving renderer stubs external.
// https://github.com/nuxt/nuxt/issues/36467
export const NUXT_RUNTIME_INLINE = /[\\/]node_modules[\\/]nuxt[\\/]dist[\\/]/
