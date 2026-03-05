/// <reference types="cypress" />

const TREATMENTS_URL = "/calculator/treatments";
const NS_URL = "http://localhost:7880";
const NS_SECRET = "testtoken";

const mockTreatments = [
  {
    _id: "abc123",
    eventType: "Bolus",
    created_at: "2024-06-01T12:00:00.000Z",
    insulin: 5,
    carbs: 50,
    notes: "Lunch",
  },
  {
    _id: "def456",
    eventType: "Bolus",
    created_at: "2024-06-01T08:00:00.000Z",
    insulin: 2,
    carbs: 20,
    notes: "Breakfast",
  },
];

describe("Treatments page – no Nightscout configured", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit(TREATMENTS_URL);
  });

  it("renders the Treatments header", () => {
    cy.contains("h1", "Treatments").should("be.visible");
  });

  it("shows a prompt to configure Nightscout", () => {
    cy.contains("Configure Nightscout in").should("be.visible");
    cy.contains("Settings").should("be.visible");
  });

  it("has a disabled refresh button when NS is not configured", () => {
    cy.get('button[title="Refresh"]').should("be.disabled");
  });

  it("has a back link to the calculator", () => {
    cy.get('a[href="/calculator/"]').click();
    cy.url().should("include", "/calculator/");
    cy.contains("h1", "InsulinCalc").should("be.visible");
  });

  it("Settings link in the prompt navigates to Settings page", () => {
    cy.contains("a", "Settings").click();
    cy.url().should("include", "/calculator/settings");
  });
});

describe("Treatments page – with Nightscout configured", () => {
  beforeEach(() => {
    cy.clearLocalStorage();

    cy.intercept("GET", `${NS_URL}/api/v1/insulinsettings*`, { body: [] }).as("settingsFetch");
    cy.intercept("GET", `${NS_URL}/api/v1/treatments*`, { body: mockTreatments }).as("treatmentsFetch");

    cy.visit(TREATMENTS_URL, {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          "insulin-nightscout",
          JSON.stringify({ nightscoutUrl: NS_URL, nightscoutSecret: NS_SECRET })
        );
      },
    });

    cy.wait("@treatmentsFetch");
  });

  it("does not show the Nightscout prompt when configured", () => {
    cy.contains("Configure Nightscout in").should("not.exist");
  });

  it("renders a list of treatments", () => {
    // "Lunch" and "Breakfast" are in controlled <input> values, not text content
    cy.get(".section-card").first().find('input[type="text"]').should("have.value", "Lunch");
    cy.get(".section-card").eq(1).find('input[type="text"]').should("have.value", "Breakfast");
  });

  it("displays insulin, carbs, and notes fields for each treatment", () => {
    cy.contains("label", "Insulin (U)").should("be.visible");
    cy.contains("label", "Carbs (g)").should("be.visible");
    cy.contains("label", "Notes").should("be.visible");
  });

  it("shows treatment event type and timestamp", () => {
    cy.get(".section-card").first().contains("Bolus").should("be.visible");
    // Timestamp should be rendered (exact string depends on locale, just check presence)
    cy.get(".section-card").first().find("p.text-xs").should("not.be.empty");
  });

  it("renders Save and Delete buttons for each treatment", () => {
    cy.get(".section-card").each(($card) => {
      cy.wrap($card).contains("button", "Save").should("be.visible");
      cy.wrap($card).contains("button", "Delete").should("be.visible");
    });
  });

  it("updates a treatment draft when insulin field is changed", () => {
    // Use {selectall} to replace the existing value rather than appending
    cy.get(".section-card").first().find('input[type="number"]').first().type("{selectall}7");
    cy.get(".section-card").first().find('input[type="number"]').first().should("have.value", "7");
  });

  it("calls update API and shows success toast on Save", () => {
    cy.intercept("PUT", `${NS_URL}/api/v1/treatments/abc123*`, { body: { ok: true } }).as("updateTreatment");

    cy.get(".section-card").first().contains("button", "Save").click();
    cy.wait("@updateTreatment");
    cy.contains("Treatment updated").should("be.visible");
  });

  it("shows error toast when update API fails", () => {
    cy.intercept("PUT", `${NS_URL}/api/v1/treatments/abc123*`, {
      statusCode: 500,
      body: {},
    }).as("updateFail");

    cy.get(".section-card").first().contains("button", "Save").click();
    cy.wait("@updateFail");
    cy.contains("Update failed").should("be.visible");
  });

  it("calls delete API and removes treatment from list on Delete", () => {
    cy.intercept("DELETE", `${NS_URL}/api/v1/treatments/abc123*`, { body: { ok: true } }).as("deleteTreatment");

    // Stub the confirm dialog to return true
    cy.on("window:confirm", () => true);

    cy.get(".section-card").first().contains("button", "Delete").click();
    cy.wait("@deleteTreatment");
    cy.contains("Treatment deleted").should("be.visible");
    cy.contains("Lunch").should("not.exist");
  });

  it("does not delete when confirm dialog is cancelled", () => {
    cy.intercept("DELETE", `${NS_URL}/api/v1/treatments/abc123*`).as("noDelete");

    cy.on("window:confirm", () => false);
    cy.get(".section-card").first().contains("button", "Delete").click();
    cy.get("@noDelete.all").should("have.length", 0);
    // Treatment remains — verify the notes input still has "Lunch"
    cy.get(".section-card").first().find('input[type="text"]').should("have.value", "Lunch");
  });

  it("refreshes the list when the refresh button is clicked", () => {
    cy.intercept("GET", `${NS_URL}/api/v1/treatments.json*`, { body: mockTreatments }).as("refresh");

    cy.get('button[title="Refresh"]').click();
    cy.wait("@refresh");
    cy.get(".section-card").first().find('input[type="text"]').should("have.value", "Lunch");
  });

  it("shows 'No treatments found' when list is empty", () => {
    cy.intercept("GET", `${NS_URL}/api/v1/treatments*`, { body: [] }).as("emptyRefresh");

    cy.get('button[title="Refresh"]').click();
    cy.wait("@emptyRefresh");
    cy.contains("No treatments found.").should("be.visible");
  });
});
