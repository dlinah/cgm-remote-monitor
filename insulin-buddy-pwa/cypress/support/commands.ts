/// <reference types="cypress" />

// Configure Nightscout in localStorage so the app treats it as connected.
Cypress.Commands.add("configureNightscout", (url = "http://localhost:7880", secret = "testtoken") => {
  cy.window().then((win) => {
    win.localStorage.setItem(
      "insulin-nightscout",
      JSON.stringify({ nightscoutUrl: url, nightscoutSecret: secret })
    );
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      configureNightscout(url?: string, secret?: string): Chainable<void>;
    }
  }
}
