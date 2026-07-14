Feature: Dossier

  Background:
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Ownable Builder"
    And I set field "Name *" to "Dossier"
    And I set field "Description" to "A living file dossier"
    And I click button "Create Ownable"
    Then heading "Dossier" is visible
    And the page contains button "Add files"

  Scenario: Add a file from the dossier details screen
    When I upload the file "features/fixtures/passport-v1.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    And dialog "Selected files" contains text "passport-v1.pdf"
    When I click button "Submit"
    Then dialog "Selected files" is hidden
    And text "passport-v1.pdf" is visible
    And text "1 version" is visible
    And the page does not contain text "bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a"

  Scenario: Review and rename selected files before submission
    When I upload the file "features/fixtures/passport-v1.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    When I set field "attachment-name-bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" to "passport.pdf"
    And I click button "Submit"
    Then dialog "Selected files" is hidden
    And text "passport.pdf" is visible
    And text "1 version" is visible

  Scenario: Add a newer version of an existing file name
    When I upload the file "features/fixtures/passport-v1.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    When I set field "attachment-name-bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" to "passport.pdf"
    And I click button "Submit"
    Then dialog "Selected files" is hidden
    And text "passport.pdf" is visible
    And text "1 version" is visible
    When I upload the file "features/fixtures/passport-v2.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    When I set field "attachment-name-bafkreige52bpunsngnyc5bld6fkqsvwokzkmuyq5cl2r5u27v5viljnzdi" to "passport.pdf"
    And I click button "Submit"
    Then dialog "Selected files" is hidden
    And text "passport.pdf" is visible
    And text "2 versions" is visible
    When I click button "passport.pdf 2 versions"
    Then text "bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" is visible
    And text "bafkreige52bpunsngnyc5bld6fkqsvwokzkmuyq5cl2r5u27v5viljnzdi" is visible

  Scenario: Close a dossier
    When I click button "More options"
    And I click menuitem "Close"
    Then dialog "Close ownable" is visible
    When I click button "Confirm close"
    Then text "Closed" is visible
    And the page does not contain button "Add files"
