import gql from 'graphql-tag';

const GET_CONTACT_INSCRIPTION = gql`
  query contactInscription($id: ID!) {
    contactInscription(id: $id) {
      id
      inscriptionDate
      fields
      collectUrl
      isFirst
      contact {
        id
        email
        status
      }
      source {
        id
        name
      }
      sourceName
    }
  }
`;

const GET_FULL_CONTACT_INFORMATION = gql`
  query contact($id: ID!) {
    contact(id: $id) {
      id
      email
      firstname
      lastname
      activated
      status
      gender
      activityScore
      customFields
      lastInscription {
        id
        inscriptionDate
        source {
          id
          name
        }
      }
      inscriptions {
        id
        inscriptionDate
        collectUrl
        isFirst
        fields
        source {
          id
          name
        }
        sourceName
      }
      events {
        id
        type
        date
        messageId
        content {
          name
        }
        schedule {
          name
        }
      }
    }
  }
`;

const LAST_CONTACT_STATS = gql`
  query lastContactStats {
    lastContactStats {
      id
      date
      stats
    }
  }
`;

const CONTACT_STATS = gql`
  query contactStats($fromDate: String!, $toDate: String!) {
    contactStats(fromDate: $fromDate, toDate: $toDate) {
      id
      date
      stats
    }
  }
`;

const LAST_INSCRIPTION_STATS = gql`
  query lastInscriptionStats($fromInscriptionDate: String!, $toInscriptionDate: String!) {
    lastInscriptionStats(fromInscriptionDate: $fromInscriptionDate, toInscriptionDate: $toInscriptionDate) {
      id
      date
      inscriptionDate
      stats
    }
  }
`;

const GET_CONTENT = gql`
  query content($id: ID!) {
    content(id: $id) {
      id
      name
      isActive
      startDate
      endDate
      config
      type
      suspended
      suspensionReason
      incomesStats
      category
      partner {
        id
        name
        kitMapping
        variables
        contacts
      }
      versions {
        id
        html
        name
        subject
        senderName
        frenchEspsSubject
        previewText
        disabled
        contentTemplate {
          id
          name
          subject
          senderName
          frenchEspsSubject
          previewText
          html
        }
        templateVariables
      }
      defaultVersion {
        id
        html
        subject
        senderName
        frenchEspsSubject
        previewText
        name
        disabled
        contentTemplate {
          id
          name
          subject
          senderName
          frenchEspsSubject
          previewText
        }
        templateVariables
      }
      schedules {
        id
        name
        scheduleDate
        rate
        type
      }
      delivStats {
        request
        delivered
        soft_bounce
        hard_bounce
        click
        open
        unsub
        complaint
        unique_click
        unique_open
        unique_proxy_loaded
      }
      bats {
        id
        date
        comments
        validations
        status
        author
        validatorsEmails
        message
        partner {
          id
        }
        sendingConfig {
          id
          name
        }
      }
      history {
        id
        activity
        createdAt
        type
        user
      }
    }
  }
`;

const UPDATE_CONTENT = gql`
  query updateContent($content: JSON!) {
    updateContent(content: $content) {
      id
      name
      isActive
      startDate
      endDate
      config
      defaultVersion {
        id
        html
        subject
        senderName
        frenchEspsSubject
        disabled
        contentTemplate {
          id
          name
          subject
          senderName
          frenchEspsSubject
        }
        templateVariables
      }
      schedules {
        id
        name
        type
        scheduleDate
        rate
      }
      partner {
        id
        name
        kitMapping
        variables
      }
    }
  }
`;

const UPDATE_CONTENT_VERSION = gql`
  query updateContentVersion($contentVersion: JSON!) {
    updateContentVersion(contentVersion: $contentVersion) {
      id
      html
      subject
      frenchEspsSubject
      name
      disabled
      contentTemplate {
        id
        name
        subject
      }
      templateVariables
    }
  }
`;

const CREATE_CONTENT = gql`
  query createContent($name: String!, $type: String) {
    createContent(name: $name, type: $type) {
      id
      name
      type
    }
  }
`;

const DUPLICATE_CONTENT = gql`
  query duplicateContent($name: String!, $contentId: ID!, $type: String) {
    duplicateContent(name: $name, contentId: $contentId, type: $type) {
      id
    }
  }
`;

const DELETE_CONTENT = gql`
  query deleteContent($contentId: ID!) {
    deleteContent(contentId: $contentId)
  }
`;

const SCHEDULE_CONTENT = gql`
  query scheduleContent($contentId: ID!, $scheduleId: ID!) {
    scheduleContent(contentId: $contentId, scheduleId: $scheduleId)
  }
`;

const UNSCHEDULE_CONTENT = gql`
  query unscheduleContent($contentId: ID!, $scheduleId: ID!) {
    unscheduleContent(contentId: $contentId, scheduleId: $scheduleId)
  }
`;

const SCHEDULES = gql`
  query schedules($filter: JSON) {
    schedules(filter: $filter) {
      total
      schedules {
        id
        isActive
        name
        type
        status
        scheduleDate
        rate
        sendingConfig {
          id
          name
        }
      }
    }
  }
`;

const CREATE_SCHEDULE = gql`
  query createSchedule($name: String!, $type: String) {
    createSchedule(name: $name, type: $type) {
      id
      name
      type
    }
  }
`;

const UPDATE_SCHEDULE = gql`
  query updateSchedule($schedule: JSON!) {
    updateSchedule(schedule: $schedule) {
      id
      name
      isActive
      type
      config
      scheduleDate
      rate
      status
      sendingConfig {
        id
        name
      }
    }
  }
`;

const SENDING_CONFIGS = gql`
  query sendingConfigs {
    sendingConfigs {
      id
      name
      config
    }
  }
`;

export {
  GET_FULL_CONTACT_INFORMATION,
  GET_CONTACT_INSCRIPTION,
  LAST_CONTACT_STATS,
  CONTACT_STATS,
  LAST_INSCRIPTION_STATS,
  GET_CONTENT,
  UPDATE_CONTENT,
  UPDATE_CONTENT_VERSION,
  CREATE_CONTENT,
  DUPLICATE_CONTENT,
  DELETE_CONTENT,
  SCHEDULE_CONTENT,
  UNSCHEDULE_CONTENT,
  SCHEDULES,
  CREATE_SCHEDULE,
  UPDATE_SCHEDULE,
  SENDING_CONFIGS
};
