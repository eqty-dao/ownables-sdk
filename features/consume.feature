Feature: Consume

  Scenario: Paint a robot
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    And I click button "Issue an Ownable Create a new ownable from a package"
    And I click button "Paint Consumable for Robot"
    And I click button "Use Item"
    Then the page contains text "Select which Ownable should consume this"
    When I click button "Robot"
    Then heading "Paint" is visible
    And text "Consumed" within `main span.line-through` is visible
    And the page contains button "Archived 1"

  Scenario: Cancel consume mode
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    And I click button "Issue an Ownable Create a new ownable from a package"
    And I click button "Paint Consumable for Robot"
    And I click button "Use Item"
    Then the page contains text "Select which Ownable should consume this"
    When I click button "Cancel"
    Then heading "Paint" is visible
    And the page contains button "Use Item"
