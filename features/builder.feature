Feature: Browser Builder

  Scenario: Create and issue an ownable through the browser builder
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Builder"
    And I set field "Name *" to "Builder Badge"
    And I set field "Description" to "Built locally in the browser"
    And I upload the file "src/assets/cube.png" into the "Choose thumbnail…" file input
    And I click button "Create Ownable"
    Then the page contains text "Built locally in the browser"
    When I click button "Builder Badge"
    Then heading "Basic" is visible

  Scenario: Browser builder validates required inputs
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Builder"
    And I click button "Create Ownable"
    Then the page contains text "Name is required"
