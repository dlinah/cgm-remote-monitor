/// <reference types="cypress" />

const SETTINGS_URL = "/calculator/settings";
const NS_URL = "http://localhost:7880";
const NS_SECRET = "testtoken";

describe("Settings page – no Nightscout configured", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.intercept("GET", "**/api/v1/**", { statusCode: 404 }).as("anyApi");
    cy.visit(SETTINGS_URL);
  });

  it("renders the settings header", () => {
    cy.contains("h1", "Settings").should("be.visible");
  });

  it("has a back link to the calculator", () => {
    cy.get('a[href="/calculator/"]').should("exist").click();
    cy.url().should("include", "/calculator/");
    cy.contains("h1", "InsulinCalc").should("be.visible");
  });

  it("shows Insulin Parameters section with all fields", () => {
    cy.contains("Insulin Parameters").should("be.visible");
    cy.contains("Carbohydrate Ratio (g per 1U)").should("be.visible");
    cy.contains("Insulin Sensitivity Factor (mg/dL per 1U)").should("be.visible");
    cy.contains("Target Blood Glucose (mg/dL)").should("be.visible");
    cy.contains("Insulin Action Duration (hours)").should("be.visible");
  });

  it("shows the Nightscout section", () => {
    cy.contains("Nightscout").should("be.visible");
    cy.contains("label", "Base URL").should("be.visible");
    cy.contains("label", "API Secret or Token").should("be.visible");
    cy.contains("Save Nightscout").should("be.visible");
  });

  it("shows the Save Settings button", () => {
    cy.contains("button", "Save Settings").should("be.visible");
  });

  it("pre-fills default values", () => {
    cy.contains("Carbohydrate Ratio").parent().find("input").should("have.value", "10");
    cy.contains("Insulin Sensitivity Factor").parent().find("input").should("have.value", "50");
    cy.contains("Target Blood Glucose").parent().find("input").should("have.value", "100");
    cy.contains("Insulin Action Duration").parent().find("input").should("have.value", "4");
  });

  it("shows a validation error when ratios are set to 0", () => {
    cy.intercept("POST", "**/api/v1/insulinsettings*", { body: { ok: true } }).as("save");

    cy.contains("Carbohydrate Ratio").parent().find("input").clear().type("0");
    cy.contains("button", "Save Settings").click();

    // Should NOT call API – validation blocks it
    cy.wait(300);
    cy.get("@save.all").should("have.length", 0);
    cy.contains("Ratios must be greater than 0").should("be.visible");
  });
});

describe("Settings page – with Nightscout configured", () => {
  beforeEach(() => {
    cy.clearLocalStorage();

    cy.intercept("GET", `${NS_URL}/api/v1/insulinsettings*`, { body: [] }).as("settingsFetch");

    cy.visit(SETTINGS_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          "insulin-nightscout",
          JSON.stringify({ nightscoutUrl: NS_URL, nightscoutSecret: NS_SECRET })
        );
      },
    });
  });

  it("saves settings to Nightscout API on Save Settings", () => {
    cy.intercept("POST", `${NS_URL}/api/v1/insulinsettings*`, { body: { ok: true } }).as("saveSettings");

    cy.contains("Carbohydrate Ratio").parent().find("input").clear().type("12");
    cy.contains("button", "Save Settings").click();

    cy.wait("@saveSettings").its("request.body").should((body) => {
      expect(body.settings.carbRatio).to.equal(12);
    });
    cy.contains("Settings saved").should("be.visible");
  });

  it("shows error toast when settings API returns an error", () => {
    cy.intercept("POST", `${NS_URL}/api/v1/insulinsettings*`, {
      statusCode: 500,
      body: {},
    }).as("saveFail");

    cy.contains("button", "Save Settings").click();
    cy.wait("@saveFail");
    cy.contains("Save failed").should("be.visible");
  });

  it("saves Nightscout credentials locally without API call", () => {
    cy.intercept("POST", `${NS_URL}/api/v1/insulinsettings*`).as("noApiCall");

    cy.contains("label", "Base URL").parent().find("input").clear().type("http://new-ns.example.com");
    cy.contains("button", "Save Nightscout").click();
    cy.contains("Nightscout settings saved locally").should("be.visible");

    // No API should have been called for Nightscout-only save
    cy.get("@noApiCall.all").should("have.length", 0);
  });

  it("updates carb ratio and reflects it on the calculator page", () => {
    cy.intercept("POST", `${NS_URL}/api/v1/insulinsettings*`, { body: { ok: true } }).as("save");
    cy.intercept("GET", `${NS_URL}/api/v1/entries.json*`, { body: [] }).as("bgFetch");
    cy.intercept("GET", `${NS_URL}/api/v1/treatments*`, { body: [] }).as("iobFetch");

    cy.contains("Carbohydrate Ratio").parent().find("input").clear().type("15");
    cy.contains("button", "Save Settings").click();
    cy.wait("@save");

    // Navigate back and verify the new carb ratio is shown
    cy.get('a[href="/calculator/"]').click();
    cy.contains("1:15").should("be.visible");
  });
});
