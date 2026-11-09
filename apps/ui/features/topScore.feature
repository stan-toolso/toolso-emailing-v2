Feature: Top Score
    Specifications for topScore calculation

    Scenario: identical contents produce identical score
        Given content_1 and content_2 are identical contents
        When I calculate topScore of contents
        Then score of content_1 is equal to score of content_2

    Scenario: only clickRate does count
        Given content_1 and content_2 are identical contents
        Given content_1 requests is doubled
        Given content_1 clicks is doubled
        When I calculate topScore of contents
        Then score of content_1 is equal to score of content_2

    Scenario: clicks number does count
        Given content_1 and content_2 are identical contents
        Given content_1 clicks increase by 10
        When I calculate topScore of contents
        Then score of content_1 is higher than score of content_2

    Scenario: Request number does count
        Given content_1 and content_2 are identical contents
        Given content_2 requests increase by 10
        When I calculate topScore of contents
        Then score of content_1 is higher than score of content_2


