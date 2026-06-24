Feature: Dossier

  Scenario: Add a file from the dossier details screen
    Given I'm on the homepage
    And I have a Dossier
    When I upload the file "features/fixtures/passport-v1.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    And dialog "Selected files" contains text "passport-v1.pdf"
    When I click button "Submit"
    Then text "passport-v1.pdf" is visible
    And text "bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" is visible

  Scenario: Review and rename selected files before submission
    Given I'm on the homepage
    And I have a Dossier
    When I upload the file "features/fixtures/passport-v1.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    When I set field "attachment-name-bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" to "passport.pdf"
    And I click button "Submit"
    Then text "passport.pdf" is visible
    And text "bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" is visible

  Scenario: Add a newer version of an existing file name
    Given I'm on the homepage
    And I have a Dossier
    When I upload the file "features/fixtures/passport-v1.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    When I set field "attachment-name-bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" to "passport.pdf"
    And I click button "Submit"
    When I upload the file "features/fixtures/passport-v2.pdf" into the "Add files" file input
    Then dialog "Selected files" is visible
    When I set field "attachment-name-bafkreige52bpunsngnyc5bld6fkqsvwokzkmuyq5cl2r5u27v5viljnzdi" to "passport.pdf"
    And I click button "Submit"
    Then text "passport.pdf" is visible
    And text "2 versions" is visible
    And text "bafkreidlriigempjy6uusqwznuthahrel6jonsrj7tw3r6mwbdbg3c7h4a" is visible
    And text "bafkreige52bpunsngnyc5bld6fkqsvwokzkmuyq5cl2r5u27v5viljnzdi" is visible

  Scenario: Close a dossier
    Given I'm on the homepage
    And I have a Dossier
    When I click button "Close"
    Then dialog "Close ownable" is visible
    When I click button "Confirm close"
    Then text "Closed" is visible
    And the page does not contain button "Add files"
