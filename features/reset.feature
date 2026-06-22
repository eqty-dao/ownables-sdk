Feature: Reset

  Scenario: Delete all ownables
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    And I click button "menu"
    And I click button "Delete All Ownables"
    Then the page contains button "Delete all"
    When I click button "Delete all"
    Then the page contains button "Issue an Ownable Create a new ownable from a package"

  Scenario: Factory reset an issued wallet
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    And I click button "menu"
    And I click button "Factory Reset"
    Then the page contains button "Delete everything"
    When I click button "Delete everything"
    Then the page contains button "Issue an Ownable Create a new ownable from a package"
