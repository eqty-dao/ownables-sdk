Feature: Browser Builder

  Scenario: Create and issue a dossier through the browser builder
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Ownable Builder"
    Then the page does not contain text "Widget HTML"
    When I set field "Name *" to "Incident dossier"
    And I set field "Description" to "A living file dossier"
    And I upload the file "src/assets/cube.png" into the "Thumbnail" file input
    Then the page contains text "cube.png"
    And I click button "Create Ownable"
    Then navigation "Ownable list" contains text "Incident dossier"
    And navigation "Ownable list" contains `text="Dossier"`
    And main contains heading "Incident dossier"
    And main contains button "Add files"
    When I click button "Issue an Ownable"
    Then main does not contain button "Incident dossier"

  Scenario: Browser builder validates required inputs
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Ownable Builder"
    And I click button "Create Ownable"
    Then the page contains text "Name is required"
    When I set field "Name *" to "Dossier"
    And I click button "Create Ownable"
    Then the page contains text "Description is required"
