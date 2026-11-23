@requires-hub @story-18
Feature: Verify consumed Ownables

  Scenario: Export and verify a Robot painted by a consumed Ownable
    Given I'm on the homepage
    When I click button "menu"
    And I check switch "Anchor events"
    And I click button "Close settings"
    And I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    When I click button "Issue an Ownable Create a new ownable from a package"
    And I click button "Paint Consumable for Robot"
    And I click button "Use Item"
    Then the page contains text "Select which Ownable should consume this"
    When I click button "Robot"
    Then text "Consumed" within `main span.line-through` is visible
    When I click button "Robot"
    And I click button "More options"
    And I download the Ownable archive
    Then the Robot archive contains its signed Paint proof as a separate attachment
    When the Hub indexes the Ownable anchors
    Then a fresh wallet imports the Robot and renders the verified Paint color
    And a fresh wallet rejects the Robot with its Paint proof missing
    And a fresh wallet rejects the Robot with its Paint proof changed

  Scenario: Reject an archive whose consumption has no Anchor evidence
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    When I click button "Issue an Ownable Create a new ownable from a package"
    And I click button "Paint Consumable for Robot"
    And I click button "Use Item"
    Then the page contains text "Select which Ownable should consume this"
    When I click button "Robot"
    Then text "Consumed" within `main span.line-through` is visible
    When I click button "Robot"
    And I click button "More options"
    And I download the Ownable archive
    Then the Robot archive contains its signed Paint proof as a separate attachment
    And a fresh wallet rejects the Robot without Anchor evidence
