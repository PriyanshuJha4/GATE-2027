self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  // Service worker activated
});

self.addEventListener("fetch", (event) => {
  // Pass through requests
});