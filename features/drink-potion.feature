Feature: Drink potion ownable

  Background:
    Given the wallet is clean
    And there is a "potion" Ownable
    When I click button "Potion" within navigation "Ownable list"
    Then the page contains button "Drink" within iframe "Ownable widget"
    And the page contains text "100" within iframe "Ownable widget"

  Scenario: Drink part of the potion
    When I set `input[type="range"]` within iframe "Ownable widget" to 30
    And I click button "Drink" within iframe "Ownable widget"
    Then the page contains text "70" within iframe "Ownable widget"

  Scenario: Drinking more than available shows an error
    When I set `input[type="range"]` within iframe "Ownable widget" to 40
    And I click button "Drink" within iframe "Ownable widget"
    And I click button "Drink" within iframe "Ownable widget"
    And I click button "Drink" within iframe "Ownable widget"
    Then the page contains text "The Ownable returned an error"
    And the page contains text "Attempt to drink more than is available"
    And the page contains text "20" within iframe "Ownable widget"
