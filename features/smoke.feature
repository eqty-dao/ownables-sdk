Feature: Smoke

  Scenario: Smoke empty wallet
    Given I'm on the homepage
    Then the page contains text "Let's get started!"
    And the page contains button "Issue an Ownable"
    And the page contains link "the examples"

  Scenario: Open examples from empty wallet
    Given I'm on the homepage
    When I click link "the examples"
    Then heading "Issue an Ownable" is visible
    And the page contains button "Robot An adorable robot companion"
    And the page contains button "Potion Drink a colorful potion"
