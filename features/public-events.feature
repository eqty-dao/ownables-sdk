Feature: Public events

  Scenario: Stack and reset a public block ownable on local Anchor
    Given the local Anchor preflight succeeds
    And I'm on the homepage
    When I forge the example ownable "Block Stack"
    And the ownable widget is ready
    Then text "1 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I start recording widget action messages
    And I start recording local Anchor public events
    And I click button "Stack one more" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "stack"
    And the latest local Anchor public event is "stack"
    And text "2 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I click button "Reset" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "reset"
    And the latest local Anchor public event is "reset"
    And text "1 of 7 blocks stacked" within iframe "Ownable widget" is visible
