Feature: Consumed Ownable State

  Background:
    Given there are example Ownables

  Scenario: Consumed Antenna shows Consumed badge and hides Use Item button
    Given the Antenna ownable is consumed
    When I click button "Antenna" within navigation "Ownable list"
    Then The page contains text "Consumed"
    And The page does not contain button "Use Item"
