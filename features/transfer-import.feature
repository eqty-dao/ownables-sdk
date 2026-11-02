@requires-hub @story-10
Feature: Transfer and import through Hub

  Scenario: Transfer an Ownable to a controlled recipient and import it
    Given the transfer and import proof is reset
    And I'm on the homepage
    When I click button "Issue an Ownable"
    And I click button "Robot An adorable robot companion"
    Then heading "Robot" is visible
    And the ownable widget is ready
    When I click button "More options"
    And I click menuitem "Transfer"
    And I set field "Recipient address" to "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    And I click button "Ok"
    Then the Hub upload response is pending for the transfer
    And the page contains text "Hub verification is pending."
    Given I switch the controlled E2E wallet to address index 1
    Then recipient discovery has its initial snapshot and availability stream
    And the page does not contain button "Import Robot"
    When the Hub indexes the pending transfer upload
    Then the recipient observes button "Import Robot" through the availability stream without another snapshot
    When I click button "Import Robot"
    Then heading "Robot" is visible
