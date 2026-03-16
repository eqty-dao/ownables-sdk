Feature: Settings drawer controls
  As a wallet user
  I want settings controls to be interactive
  So I can toggle anchor events and choose appearance mode

  Scenario: Settings drawer shows theme mode and anchor toggle controls
    Given I open the app
    When I open the settings drawer
    Then I should see three theme mode buttons:
      | Light  |
      | Dark   |
      | System |
    And I should see an Anchor events toggle control
