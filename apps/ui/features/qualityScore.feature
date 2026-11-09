Feature: Quality Score
    Specifications for quality calculation


    Scenario: clicks counts more than opens
        Given schedule_1 and schedule_2 have identical delivStats
        Given schedule_1 opens increased by 1000
        Given schedule_2 clicks increased by 1000
        When I calculate qualityScore of schedules
        Then score of schedule_2 is higher than score of schedule_1


    Scenario: identical contents produce identical score
        Given schedule_1 and schedule_2 have identical delivStats
        When I calculate qualityScore of schedules
        Then score of schedule_1 is equal to score of schedule_2

    Scenario: clicks counts 10 opens
        Given schedule_1 and schedule_2 have identical delivStats
        Given schedule_1 opens increased by 100
        Given schedule_2 clicks increased by 10
        When I calculate qualityScore of schedules
        Then score of schedule_2 is equal to score of schedule_2

    Scenario: lowest score is low
        Given schedule_1 has 0% clickRate and 0% openRate and 100% contactScore and 0 unsubs and 0 complaints
        When I calculate qualityScore of schedules
        Then score of schedule_1 is lower than 5%

    Scenario: highest score is high
        Given schedule_1 has 100% clickRate and 100% openRate and 0% contactScore and 10000 unsubs and 1000 complaints
        When I calculate qualityScore of schedules
        Then score of schedule_1 is higher than 95%

    Scenario: average score is 50
        Given schedule_1 has 1.85% clickRate and 20% openRate and 50% contactScore and 0 unsubs and 0 complaints
        When I calculate qualityScore of schedules
        Then score of schedule_1 is equal to 50

    Scenario: activity score is more impotant times more than contact score
        Given schedule_1 and schedule_2 have identical delivStats
        Given schedule_1 clickRate increases by 10%
        Given schedule_1 openRate increases by 10%
        Given schedule_2 contactScoreRate decreases by 10%
        When I calculate qualityScore of schedules
        Then score of schedule_1 is higher than score of schedule_2


    Scenario: unsubs does count
        Given schedule_1 and schedule_2 have identical delivStats
        Given schedule_1 unsubs increase by 1000
        When I calculate qualityScore of schedules
        Then score of schedule_2 is higher than score of schedule_1


    Scenario: complaints does count
        Given schedule_1 and schedule_2 have identical delivStats
        Given schedule_1 complaints increase by 1000
        When I calculate qualityScore of schedules
        Then score of schedule_2 is higher than score of schedule_1

    Scenario: plaints counts more than unsubs
        Given schedule_1 and schedule_2 have identical delivStats
        Given schedule_1 unsubs increase by 2000
        Given schedule_2 complaints increase by 2000
        When I calculate qualityScore of schedules
        Then score of schedule_1 is higher than score of schedule_2