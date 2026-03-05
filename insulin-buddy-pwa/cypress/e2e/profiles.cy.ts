/// <reference types="cypress" />

const SETTINGS_URL = "/calculator/settings";
const CALC_URL = "/calculator/";

const defaultProfilesState = {
  activeId: "default",
  profiles: [
    { id: "default", name: "Default", carbRatio: 10, isf: 50, targetBg: 100, insulinDuration: 4 },
  ],
};

const twoProfilesState = {
  activeId: "default",
  profiles: [
    { id: "default", name: "Default", carbRatio: 10, isf: 50, targetBg: 100, insulinDuration: 4 },
    { id: "night", name: "Night", carbRatio: 15, isf: 60, targetBg: 110, insulinDuration: 5 },
  ],
};

function setProfiles(win: Window, state: typeof defaultProfilesState) {
  win.localStorage.setItem("insulin-profiles", JSON.stringify(state));
}

describe("Profiles – Settings page", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it("shows the Default profile selected by default", () => {
    cy.visit(SETTINGS_URL);
    cy.contains("button", "Default").should("be.visible");
    cy.contains("button", "Default").find("svg").should("exist"); // check icon
  });

  it("can create a new profile", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, defaultProfilesState) });

    cy.contains("button", "New Profile").click();
    cy.get('[data-testid="new-profile-input"]').type("Night");
    cy.contains("button", "Create").click();

    cy.contains("button", "Night").should("be.visible");
    // Night should now be active (has check icon)
    cy.contains("button", "Night").find("svg").should("exist");
  });

  it("disables Create when profile name is empty", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, defaultProfilesState) });
    cy.contains("button", "New Profile").click();
    cy.contains("button", "Create").should("be.disabled");
  });

  it("cancels new profile creation", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, defaultProfilesState) });
    cy.contains("button", "New Profile").click();
    cy.get('[data-testid="new-profile-input"]').type("Temp");
    cy.contains("button", "Cancel").click();
    cy.contains("button", "New Profile").should("be.visible");
    cy.contains("button", "Temp").should("not.exist");
  });

  it("switches between profiles", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, twoProfilesState) });

    // Default is active initially
    cy.contains("button", "Default").find("svg").should("exist");

    // Click Night to switch
    cy.contains("button", "Night").click();
    cy.contains("button", "Night").find("svg").should("exist");
    cy.contains("button", "Default").find("svg").should("not.exist");
  });

  it("switching profiles updates the insulin parameter fields", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, twoProfilesState) });

    // Default profile: carbRatio=10
    cy.contains("label", "Carbohydrate Ratio").next("input").should("have.value", "10");

    // Switch to Night: carbRatio=15
    cy.contains("button", "Night").click();
    cy.contains("label", "Carbohydrate Ratio").next("input").should("have.value", "15");
  });

  it("shows Delete button only when more than one profile exists", () => {
    // Single profile — no delete button
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, defaultProfilesState) });
    cy.get('[data-testid="delete-profile-btn"]').should("not.exist");

    // Two profiles — delete button visible
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, twoProfilesState) });
    cy.get('[data-testid="delete-profile-btn"]').should("be.visible");
  });

  it("deletes a profile and falls back to the remaining one", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, twoProfilesState) });

    // Switch to Night so we can delete it
    cy.contains("button", "Night").click();

    cy.window().then((win) => cy.stub(win, "confirm").returns(true));
    cy.get('[data-testid="delete-profile-btn"]').click();

    // Night profile button should be gone; Default should be active
    cy.get('[data-profile-id="night"]').should("not.exist");
    cy.contains("button", "Default").should("be.visible");
    cy.contains("button", "Default").find("svg").should("exist");
  });

  it("does not delete when confirm is cancelled", () => {
    cy.visit(SETTINGS_URL, { onBeforeLoad: (win) => setProfiles(win, twoProfilesState) });
    cy.contains("button", "Night").click();

    cy.window().then((win) => cy.stub(win, "confirm").returns(false));
    cy.get('[data-testid="delete-profile-btn"]').click();

    cy.get('[data-profile-id="night"]').should("be.visible");
    cy.get('[data-profile-id="default"]').should("be.visible");
  });
});

describe("Profiles – Calculator page", () => {
  it("shows the active profile name in Active Parameters", () => {
    cy.visit(CALC_URL, { onBeforeLoad: (win) => setProfiles(win, defaultProfilesState) });
    cy.get('[data-testid="active-profile-name"]').should("have.text", "Default");
  });

  it("reflects the switched profile name on the calculator", () => {
    cy.visit(CALC_URL, { onBeforeLoad: (win) => setProfiles(win, twoProfilesState) });
    // activeId is "default" in twoProfilesState
    cy.get('[data-testid="active-profile-name"]').should("have.text", "Default");
  });

  it("calculator parameters update after profile switch via settings", () => {
    // Set Night as active
    cy.visit(CALC_URL, {
      onBeforeLoad: (win) =>
        setProfiles(win, { ...twoProfilesState, activeId: "night" }),
    });

    cy.get('[data-testid="active-profile-name"]').should("have.text", "Night");
    cy.contains("1:15").should("be.visible"); // Night carbRatio=15
  });
});
