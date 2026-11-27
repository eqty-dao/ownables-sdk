Feature: Inspect

  Scenario: View an issued robot
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    And the page contains text "An adorable robot companion"
    When I click button "More information"
    Then the page contains text "Signed by:"
    And the page contains text "Media type:"
    And the page does not contain button "Unlock"

  @requires-hub @story-16
  Scenario: Verify the anchors of a locally issued Robot
    Given the Hub transport verifier backend is reset
    And I'm on the homepage
    When I click button "menu"
    And I check switch "Anchor events"
    And I click button "Close settings"
    And I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    And the ownable widget is ready
    And I click button "More information"
    Then the page contains text "No indexed anchor"
    When I click button "Close"
    And the Hub indexes the local anchor
    And I click button "More information"
    Then the page contains text "Anchors verified"
    And the page contains text "Hub anchor evidence"
    And the page contains text "Signed by:"
