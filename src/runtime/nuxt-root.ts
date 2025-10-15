import { Suspense, defineComponent, h, onErrorCaptured, provide } from 'vue'

// --- Safe dynamic import fallback for Nuxt virtual modules ---
let isNuxtError = (err: any) => false
let useNuxtApp = () => ({ deferHydration: () => {}, hooks: { callHook: async () => {}, callHookWith: () => [] } })
let useRoute = () => ({})
let PageRouteSymbol: any = Symbol('PageRouteSymbol')

try {
  const nuxt = await import('#imports')
  const app = await import('#app/components/injections')

  isNuxtError = nuxt.isNuxtError ?? isNuxtError
  useNuxtApp = nuxt.useNuxtApp ?? useNuxtApp
  useRoute = nuxt.useRoute ?? useRoute
  PageRouteSymbol = app.PageRouteSymbol ?? PageRouteSymbol
} catch {
  // Running outside of Nuxt context (e.g. Vitest)
}

// --- Component definition ---
export default defineComponent({
  setup(_options, { slots }) {
    const nuxtApp = useNuxtApp()

    // Inject default route (outside of pages) as active route
    provide(PageRouteSymbol, useRoute())

    const done = nuxtApp.deferHydration?.() ?? (() => {})

    // vue:setup hook
    const results = nuxtApp.hooks?.callHookWith?.(
      (hooks: any) => hooks.map((hook: any) => hook()),
      'vue:setup'
    ) ?? []
    if (import.meta.dev && results.some((i: any) => i && 'then' in i)) {
      console.error('[nuxt] Error in `vue:setup`. Callbacks must be synchronous.')
    }

    // error handling
    onErrorCaptured((err, target, info) => {
      nuxtApp.hooks?.callHook?.('vue:error', err, target, info)
        .catch((hookError: any) =>
          console.error('[nuxt] Error in `vue:error` hook', hookError)
        )
      if (isNuxtError(err) && (err.fatal || err.unhandled)) {
        return false // suppress error from breaking render
      }
    })

    return () =
