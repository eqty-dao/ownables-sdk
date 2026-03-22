Feature: Ownable 2-Column Layout

  Background:
    Given there are example Ownables

  Scenario: Desktop shows 2-column layout with list and detail panel
    Then The page contains navigation "Ownable list"
    And The page contains region "Ownable detail"

  Scenario: Clicking a list item selects it and updates the detail panel
    When I click button "Antenna" within navigation "Ownable list"
    Then region "Ownable detail" contains text "Antenna"

  Scenario: Ownable without image metadata shows a fallback placeholder icon
    Then The page contains image "No image"

  Scenario: Consumable ownable shows badge and Use Item button
    When I click button "Antenna" within navigation "Ownable list"
    Then The page contains text "Consumable"
    And The page contains button "Use Item"
