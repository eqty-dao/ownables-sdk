Feature: Issue ownable

  Scenario: Issue an ownable from available packages
    Given I'm on the homepage
    When I click button "Issue an Ownable" within navigation "Ownable list"
    And I click button "Antenna"
    Then the page contains button "Use Item"
    And the page does not contain button "Connect to wallet"
