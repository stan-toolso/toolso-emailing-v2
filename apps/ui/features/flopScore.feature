Feature: Flop Score
    Specifications for flopScore calculation

    Scenario: identical contents produce identical score
        Given content_1 and content_2 are identical contents
        When I calculate flopScore of contents
        Then score of content_1 is equal to score of content_2

    Scenario: unsubs does count
        Given content_1 and content_2 are identical contents
        Given content_1 unsubs increase by 10
        When I calculate flopScore of contents
        Then score of content_1 is higher than score of content_2

    Scenario: complaints does count
        Given content_1 and content_2 are identical contents
        Given content_1 complaints increase by 10
        When I calculate flopScore of contents
        Then score of content_1 is higher than score of content_2

    Scenario: complaints worth 10 unsubs
        Given content_1 and content_2 are identical contents
        Given content_1 unsubs increase by 10
        Given content_2 complaints increase by 1
        When I calculate flopScore of contents
        Then score of content_1 is equal to score of content_2

    Scenario: Request number does count
        Given content_1 and content_2 are identical contents
        Given content_2 requests increase by 10
        When I calculate flopScore of contents
        Then score of content_1 is higher than score of content_2


