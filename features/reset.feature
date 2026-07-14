Feature: Reset

  Scenario: Delete all ownables
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    And I click button "menu"
    And I click button "Delete All Ownables"
    Then the page contains button "Delete all"
    When I click button "Delete all"
    Then the wallet is empty

  Scenario: Factory reset an issued wallet
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    And I click button "menu"
    And I click button "Factory Reset"
    Then the page contains button "Delete everything"
    When I click button "Delete everything"
    Then the wallet is empty
