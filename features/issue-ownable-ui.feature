Feature: Issue Ownable UI

  Background:
    Given there are example Ownables

  Scenario: Issue flow does not show a floating add button
    When I click button "+ Issue an Ownable" within navigation "Ownable list"
    Then The page does not contain button "add"
