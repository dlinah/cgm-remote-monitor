/// <reference types="cypress" />

const BASE = "/calculator/";

describe("Calculator page – no Nightscout configured", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    // Stub any accidental network calls so tests are isolated.
    cy.intercept("GET", "**/api/v1/**", { statusCode: 404 }).as("anyApi");
    cy.visit(BASE);
  });

  it("renders the page header", () => {
    cy.contains("h1", "InsulinCalc").should("be.visible");
  });

  it("shows a dash for recommended dose when no input is entered", () => {
    cy.contains("Recommended Dose").should("be.visible");
    cy.contains("p", "—").should("be.visible");
  });

  it("displays active parameters with default settings", () => {
    cy.contains("Active Parameters").should("be.visible");
    cy.contains("Carb Ratio").should("be.visible");
    cy.contains("1:10").should("be.visible");
    cy.contains("ISF").should("be.visible");
    cy.contains("50").should("be.visible");
    cy.contains("Target BG").should("be.visible");
    cy.contains("100").should("be.visible");
  });

  it("shows Nightscout connection hint", () => {
    cy.contains("Connect to").should("be.visible");
    cy.contains("Nightscout in Settings").should("be.visible");
  });

  it("has navigation links to Settings and Treatments", () => {
    // Settings icon link
    cy.get('a[href="/calculator/settings"]').should("exist");
    // Treatments icon link
    cy.get('a[href="/calculator/treatments"]').should("exist");
  });

  it("calculates a carb dose when carbs are entered", () => {
    // 60g carbs, carbRatio=10 → carbDose=6U, correction=0, total=6U
    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("6.0").should("be.visible");
    // Breakdown cards appear
    cy.contains("Carb").should("be.visible");
    cy.contains("Correction").should("be.visible");
    cy.contains("IOB").should("be.visible");
  });

  it("calculates a correction dose when BG is entered above target", () => {
    // BG=150, target=100, ISF=50 → correction=1U
    // The BG input's placeholder is the targetBg value (100 by default)
    cy.get('input[placeholder="100"]').type("150");
    cy.contains("1.0").should("be.visible");
  });

  it("calculates combined carb + correction dose", () => {
    // 60g carbs → carbDose=6U; BG=150, correction=1U; total=7U
    cy.get('input[placeholder="0"]').first().type("60");
    cy.get('input[placeholder="100"]').type("150");
    cy.contains("7.0").should("be.visible");
  });

  it("shows dose breakdown details when the dose card is clicked", () => {
    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("Show calculation details").click();
    cy.get("#dose-details").should("be.visible");
    cy.contains("How this dose was calculated").should("be.visible");
    cy.contains("Meal Carbs").should("be.visible");
    cy.contains("Carb dose").should("be.visible");
  });

  it("hides dose breakdown details when the dose card is clicked again", () => {
    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("Show calculation details").click();
    cy.contains("Hide calculation details").click();
    cy.get("#dose-details").should("not.exist");
  });

  it("does not show Send to Nightscout button when NS is not configured", () => {
    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("Send to Nightscout").should("not.exist");
  });

  it("navigates to Settings page", () => {
    // Use the header settings icon link (there are two links to /settings on this page)
    cy.get('header a[href="/calculator/settings"]').click();
    cy.url().should("include", "/calculator/settings");
    cy.contains("h1", "Settings").should("be.visible");
  });

  it("navigates to Treatments page", () => {
    cy.get('a[href="/calculator/treatments"]').click();
    cy.url().should("include", "/calculator/treatments");
    cy.contains("h1", "Treatments").should("be.visible");
  });
});

describe("Calculator page – Nightscout configured", () => {
  const NS_URL = "http://localhost:7880";
  const NS_SECRET = "testtoken";

  beforeEach(() => {
    cy.clearLocalStorage();

    // Stub API calls that fire on load
    // fetchLatestGlucose calls /api/v1/entries.json?count=1
    cy.intercept("GET", `${NS_URL}/api/v1/entries.json*`, {
      body: [{ sgv: 140, dateString: new Date().toISOString() }],
    }).as("bgFetch");

    cy.intercept("GET", `${NS_URL}/api/v1/treatments*`, {
      body: [],
    }).as("iobFetch");

    cy.intercept("GET", `${NS_URL}/api/v1/insulinsettings*`, {
      body: [],
    }).as("settingsFetch");

    cy.visit(BASE, {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          "insulin-nightscout",
          JSON.stringify({ nightscoutUrl: NS_URL, nightscoutSecret: NS_SECRET })
        );
      },
    });
  });

  it("shows the refresh button when NS is configured", () => {
    cy.get('button[title="Refresh from Nightscout"]').should("exist");
  });

  it("does not show Nightscout connection hint when NS is configured", () => {
    cy.contains("Connect to").should("not.exist");
  });

  it("shows Send to Nightscout button when carbs are entered", () => {
    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("Send to Nightscout").should("be.visible");
  });

  it("shows error toast when Send to Nightscout fails", () => {
    cy.intercept("POST", `${NS_URL}/api/v1/treatments*`, {
      statusCode: 500,
      body: { error: "server error" },
    }).as("logFail");

    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("Send to Nightscout").click();
    cy.wait("@logFail");
    cy.contains("Failed").should("be.visible");
  });

  it("clears inputs and shows success toast after successful log", () => {
    cy.intercept("POST", `${NS_URL}/api/v1/treatments*`, { body: { ok: true } }).as("logOk");

    cy.get('input[placeholder="0"]').first().type("60");
    cy.contains("Send to Nightscout").click();
    cy.wait("@logOk");
    cy.contains("Logged to Nightscout").should("be.visible");
    // Meal carbs input cleared
    cy.get('input[placeholder="0"]').first().should("have.value", "");
  });
});
