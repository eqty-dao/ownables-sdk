Feature: Smoke

  Scenario: Smoke empty wallet
    Given I'm on the homepage
    Then the page contains button "Issue an Ownable"

  Scenario: Open ownable examples from empty wallet
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    Then heading "Issue an Ownable" is visible
    And the page contains button "Robot An adorable robot companion"
    And the page contains button "Potion Drink a colorful potion"
