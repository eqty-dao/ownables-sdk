Feature: Load example ownables

  Scenario: Load examples from the empty state
    Given I'm on the homepage
    When I click text "the examples"
    Then the page contains button "Use Item"
    And the page does not contain button "Connect to wallet"
