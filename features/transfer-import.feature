Feature: Transfer and import through Hub

  Scenario: Transfer an Ownable to a controlled recipient and import it
    Given I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    When I click button "More options"
    And I click menuitem "Transfer"
    And I set field "Recipient address" to "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    And I click button "Ok"
    Then section contains text "Transferred"
    Given I switch the controlled E2E wallet to address index 1
    Then the page contains button "Import Robot"
    When I click button "Import Robot"
    Then heading "Robot" is visible
