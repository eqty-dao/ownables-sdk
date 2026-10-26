@story-1
Feature: Apply submitted public events before Hub confirmation

  Scenario: Keep locally applied public events visible while Hub confirmation is held
    Given the Hub transport verifier backend is reset
    And I'm on the homepage
    When I click button "menu"
    And I check switch "Anchor events"
    And I click button "Close settings"
    And I click button "Issue an Ownable"
    And I click button "Block Stack Stack seven crooked public blocks"
    And the ownable widget is ready
    Then the Hub recorded a public-events snapshot request for the current ownable
    And the Hub recorded a public-events stream request for the current ownable set
    When I start recording widget action messages
    And I click button "Stack one more" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "stack"
    And the tracked public-event status for the current ownable becomes "pending" for "stack"
    And text "2 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I click button "Stack one more" within iframe "Ownable widget"
    Then the latest widget action message is an emit for "stack"
    And there is exactly "2" tracked public event for "stack" on the current ownable
    And text "3 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When I click button "More information"
    Then there are exactly "2" visible "pending" public event rows for "stack"
    When I capture the visible "2" public event rows for "stack"
    And the Hub confirms the latest pending public event for the current ownable
    Then the captured public event rows remain in place and become "confirmed" for "stack"
    And text "3 of 7 blocks stacked" within iframe "Ownable widget" is visible
    When the Hub repeats the current ownable public-event stream
    Then the captured public event rows remain in place and become "confirmed" for "stack"
    And text "3 of 7 blocks stacked" within iframe "Ownable widget" is visible
