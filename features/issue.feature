Feature: Issue

  Scenario: Issue a robot example
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    When I click button "More information"
    Then the page contains text "Signed by:"
    And the page contains text "Media type:"

  Scenario: Issue multiple ownables
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    And I click button "Issue an Ownable Create a new ownable from a package"
    And I click button "Potion Drink a colorful potion"
    Then the page contains button "Robot"
    And heading "Potion" is visible
