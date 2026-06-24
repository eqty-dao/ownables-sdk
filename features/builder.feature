Feature: Browser Builder

  Scenario: Create and issue a dossier through the browser builder
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Ownable Builder"
    Then the page does not contain text "Widget HTML"
    And the page does not contain text "Thumbnail"
    When I set field "Name *" to "Dossier"
    And I set field "Description" to "A living file dossier"
    And I click button "Create Ownable"
    Then heading "Dossier" is visible
    And text "Add files" is visible
    When I click button "Issue an Ownable"
    Then `main[aria-label="main"]` does not contain `button:has-text("Dossier")`

  Scenario: Browser builder validates required inputs
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Ownable Builder"
    And I click button "Create Ownable"
    Then the page contains text "Name is required"
    When I set field "Name *" to "Dossier"
    And I click button "Create Ownable"
    Then the page contains text "Description is required"
