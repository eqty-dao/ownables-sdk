# The ordinary browser CI excludes @story-1 because it does not run the Hub stack.
# Canonical upload acceptance is covered by Hub compiled E2E and SDK client tests.
@requires-hub @story-1 @story-9
Feature: Canonical Hub public event routes

  Scenario: Observe canonical public-event routes for multiple Ownables
    Given the Hub transport verifier backend is reset
    And I'm on the homepage
    When I click button "menu"
    And I check switch "Anchor events"
    And I click button "Close settings"
    And I click button "Issue an Ownable"
    And I click button "Potion Drink a colorful potion"
    And I remember the current ownable id as "first"
    When I click button "Issue an Ownable Create a new ownable from a package"
    And I click button "Block Stack Stack seven crooked public blocks"
    And the ownable widget is ready
    And I remember the current ownable id as "second"
    Then the Hub recorded a public-events snapshot request for the current ownable
    And the Hub recorded a later public-events stream request for remembered ownables "first,second"
    And the latest Hub public-events stream request uses only repeated "ownableId" params and optional "fromBlock"
