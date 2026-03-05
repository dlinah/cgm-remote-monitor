import "./commands";

// The PWA registers a service worker that doesn't exist in dev/test mode.
// Suppress the resulting unhandled rejection so it doesn't fail every test.
Cypress.on("uncaught:exception", (err) => {
  if (err.message.includes("ServiceWorker") || err.message.includes("sw.js")) {
    return false;
  }
});
