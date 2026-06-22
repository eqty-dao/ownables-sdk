Feature: Potion

  Scenario: Drink from a potion
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Potion Drink a colorful potion"
    And the ownable widget is ready
    And I click button "Drink" within iframe "Ownable widget"
    Then text "50" within iframe "Ownable widget" is visible

  Scenario: Drink too much from a potion
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Potion Drink a colorful potion"
    And the ownable widget is ready
    And I click button "Drink" within iframe "Ownable widget"
    And I click button "Drink" within iframe "Ownable widget"
    And I click button "Drink" within iframe "Ownable widget"
    Then the page contains text "Attempt to drink more than is available"
    And text "0" within iframe "Ownable widget" is visible
