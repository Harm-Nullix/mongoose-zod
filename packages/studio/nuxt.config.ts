export default defineNuxtConfig({
  modules: ["@nuxt/ui"],

  runtimeConfig: {
    public: {
      // By default, assume we are in a safe, sandboxed documentation environment.
      // The CLI script will explicitly pass DOCS_MODE="false" to disable this.
      isDocsMode: process.env.DOCS_MODE !== "false",

      // By default, local file system access is OFF.
      // The CLI script will explicitly pass LOCAL_MODE="true" to enable it.
      isLocalMode: process.env.LOCAL_MODE === "true",
    },
  },
  css: ["~/assets/css/main.css"],

  compatibilityDate: "2026-04-01",
});
