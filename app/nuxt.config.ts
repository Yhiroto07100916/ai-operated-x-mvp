export default defineNuxtConfig({
  compatibilityDate: '2026-10-31',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || (
        process.env.NODE_ENV === 'production'
          ? 'https://ai-operated-x-worker.seiryofes-2027.workers.dev'
          : 'http://localhost:8787'
      )
    }
  },
  app: { head: { title: 'AI-operated X', meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }] } }
});
