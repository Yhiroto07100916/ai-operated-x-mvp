export default defineNuxtConfig({
  compatibilityDate: '2026-10-31',
  devtools: { enabled: true },
  runtimeConfig: {
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8787' }
  },
  app: { head: { title: 'AI-operated X', meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }] } }
});
