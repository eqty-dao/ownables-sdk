Feature: Public events

  Scenario: Stack and reset a public block ownable on local Anchor
    Given the local Anchor preflight succeeds
    And I'm on the homepage
    When I forge the example ownable "Block Stack"
    And the ownable widget is ready
    Then text "1 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I start recording widget action messages
    And I record the current private chain snapshots
    And I start recording public replay evidence
    And I start recording local Anchor public events
    And I click button "Stack one more" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "stack"
    And the latest local Anchor public event is "stack"
    And the latest local Anchor public event replay is stored
    And the private chain snapshots are unchanged
    And text "2 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I click button "Reset" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "reset"
    And the latest local Anchor public event is "reset"
    And the latest local Anchor public event replay is stored
    And the private chain snapshots are unchanged
    And text "1 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I open More information for the current ownable
    Then the More information dialog is visible for "Block Stack"
    And the More information dialog shows a replay-ordered mixed timeline
    And public timeline cards omit private chain rails
    And private timeline cards keep private chain rails

  Scenario: Change and reset Anchor allowance in settings
    Given the local Anchor preflight succeeds
    And I'm on the homepage
    When I open the Anchor allowance dialog
    Then the Anchor allowance is shown as "0.00 EQTY"
    When I save the Anchor allowance amount "5"
    Then the Anchor allowance is shown as "5.00 EQTY"
    And the local EQTY allowance is "5"
    When I open the Anchor allowance dialog
    And I reset the Anchor allowance to zero
    Then the Anchor allowance is shown as "0.00 EQTY"
    And the local EQTY allowance is "0"
