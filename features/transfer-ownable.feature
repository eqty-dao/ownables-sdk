Feature: Transfer ownable

  Scenario: Transfer a transferable ownable
    Given there are example Ownables
    When I click button "Robot" within navigation "Ownable list"
    And I click button "Ownable actions"
    And I click menuitem "Transfer"
    And I set field "Recipient address" to "0x0000000000000000000000000000000000000002"
    And I click button "Ok"
    Then the page contains text "Transferred"
    And the page not contains button "Connect to wallet"
