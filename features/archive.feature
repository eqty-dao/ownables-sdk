Feature: Archive

  Scenario: Archive and restore an ownable
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    And I click `main button:nth-of-type(2)`
    And I click menuitem "Archive"
    Then the page contains button "Archived 1"
    When I click button "Archived 1"
    And I click button "Robot"
    And I click `main button:nth-of-type(2)`
    Then the page contains menuitem "Restore"
    When I click menuitem "Restore"
    Then the page does not contain button "Archived 1"
    And heading "Robot" is visible

  Scenario: Delete an archived ownable
    Given I'm on the homepage
    When I click link "the examples"
    And I click button "Robot An adorable robot companion"
    And I click `main button:nth-of-type(2)`
    And I click menuitem "Archive"
    And I click button "Archived 1"
    And I click button "Robot"
    And I click `main button:nth-of-type(2)`
    Then the page contains menuitem "Delete"
    When I click menuitem "Delete"
    Then the page contains button "Delete"
    When I click button "Delete"
    Then the page does not contain button "Archived 1"
