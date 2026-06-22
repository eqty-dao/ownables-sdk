Feature: Inspect

  Scenario: View an issued robot
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    And the page contains text "An adorable robot companion"
    And the page contains text "More information"
    And the page does not contain button "Unlock"
