Feature: Public events

  Scenario: Confirm a pending public event from the Hub transport
    Given the Hub transport verifier backend is reset
    And my wallet is empty
    And I'm on the homepage
    When I forge the example ownable "Block Stack"
    And the ownable widget is ready
    Then the Hub recorded a public-events snapshot request for the current ownable
    And the Hub recorded a public-events stream request for the current ownable set
    When I start recording widget action messages
    And I click button "Stack one more" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "stack"
    And the tracked public-event status for the current ownable becomes "pending" for "stack"
    When the Hub confirms the latest pending public event for the current ownable
    Then the tracked public-event status for the current ownable becomes "confirmed" for "stack"
    And there is exactly "1" tracked public event for "stack" on the current ownable
    And text "2 of 7 blocks stacked" within iframe "Ownable widget" is visible

  Scenario: Reconnect the public-events stream when the watched ownable set changes
    Given the Hub transport verifier backend is reset
    And my wallet is empty
    And I'm on the homepage
    When I forge the example ownable "Potion"
    And I remember the current ownable id as "first"
    Then the Hub recorded a public-events stream request for the current ownable set
    When I forge the example ownable "Block Stack"
    And the ownable widget is ready
    And I remember the current ownable id as "second"
    Then the Hub recorded a later public-events stream request for remembered ownables "first,second"
    And the latest Hub public-events stream request uses only repeated "id" params plus "from"
