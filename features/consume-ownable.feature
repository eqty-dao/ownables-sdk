Feature: Consume ownable

  Scenario: Consume a consumable ownable
    Given there are example Ownables
    When I click button "Antenna" within navigation "Ownable list"
    And I click button "Use Item"
    And I click button "Robot" within navigation "Ownable list"
    Then the page contains text "Consumed"
    And The page does not contain button "Use Item"
    And the page not contains button "Connect to wallet"
