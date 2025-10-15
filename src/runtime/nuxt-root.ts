import { Suspense, defineComponent, h, onErrorCaptured, provide } from 'vue'

let isNuxtError = (err: any) => false
let useNuxtApp = () => ({ deferHydration: () => {}, hooks: { callHook: async () => {}, callHookWith: () => [] } })
let useRoute = () => ({})
let PageRouteSymbol: any = Symbol('PageRouteSymbol')

// ✅ async IIFE so we can use await safely even under esbuild
;(async () => {
  try {
    const nuxt = await import('#imports')
    const app = await import('#app/components/injections')

    isNuxtError = nuxt.isNuxtError ?? isNuxtError
    useNuxtApp = nuxt.useNuxtApp ?? useNuxtApp
    useRoute = nuxt.useRoute ?? useRoute
    PageRouteSymbol = app.PageRouteSymbol ?? PageRouteSymbol
  } catch {
    // running outside Nuxt (Vitest)
  }
})()

export default defineComponent({
  setup(_options, { slots }) {
    const nuxtApp = useNuxtApp()
    provide(PageRouteSymbol, useRoute())

    const done = nuxtApp.deferHydration?.() ?? (() => {})

    const results =
      nuxtApp.hooks?.callHookWith?.((hooks: any) => hooks.map((hook: any) => hook()), 'vue:setup') ?? []
    if (import.meta.dev && results.some((i: any) => i && 'then' in i)) {
      console.error('[nuxt] Error in `vue:setup`. Callbacks must be synchronous.')
    }

    onErrorCaptured((err, target, info) => {
      nuxtApp.hooks?.callHook?.('vue:error', err, target, info).catch((hookError: any) => {
        console.error('[nuxt] Error in `vue:error` hook', hookError)
      })
      if (isNuxtError(err) && (err.fatal || err.unhandled)) return false
    })

    return () => h(Suspense, { onResolve: done }, slots.default?.())
  },
})
