const { DateTimeResolver } = require('graphql-scalars');
const { resolver } = require('graphql-sequelize');
const sequelize = require('../../storage/sequelize');
const models = sequelize.get().models;

const resolvers = {
  Query: {
    myPermission: require('./resolvers/permission/my'),
    permission: require('./resolvers/permission/get'),
    permissions: require('./resolvers/permission/list'),

    schedule: require('./resolvers/schedule'),
    schedules: require('./resolvers/schedules'),

    bats: require('./resolvers/bat/list'),
    bat: require('./resolvers/bat/get'),

    partners: require('./resolvers/partner/list'),
    partner: require('./resolvers/partner/get'),

    sendingConfigs: resolver(models.SendingConfig),
    countContactsInSendingConfig: require('./resolvers/countContactsInSendingConfig'),
    mailRouters: resolver(models.MailRouter),

    senders: require('./resolvers/sender/list'),

    contact: require('./resolvers/contact'),
    contacts: require('./resolvers/contacts'),
    contactsByDimensions: require('./resolvers/contact/byDimensions'),
    contactSource: require('./resolvers/contactSource'),
    contactSources: require('./resolvers/contactSources'),
    contactInscriptions: require('./resolvers/contactInscriptions'),
    contactInscription: require('./resolvers/contactInscription'),
    contactMessages: require('./resolvers/contactMessages'),
    contactMessage: require('./resolvers/contactMessage'),
    contactMessageRules: require('./resolvers/contactMessageRules'),
    contactMessageRule: require('./resolvers/contactMessageRule'),

    blacklistedContact: require('./resolvers/blacklistedContact'),
    blacklistedContacts: require('./resolvers/blacklistedContacts'),

    exclusionLists: require('./resolvers/exclusionLists'),
    exclusionList: require('./resolvers/exclusionList'),

    inclusionLists: require('./resolvers/inclusionLists'),
    inclusionList: require('./resolvers/inclusionList'),

    contactEvent: require('./resolvers/contactEvent'),
    contactEvents: require('./resolvers/contactEvents'),

    lastContactStats: require('./resolvers/lastContactStats'),
    contactStats: require('./resolvers/contactStats'),
    lastInscriptionStats: require('./resolvers/lastInscriptionStats'),
    inscriptionStats: require('./resolvers/inscriptionStats'),

    content: require('./resolvers/content'),
    contents: require('./resolvers/contents'),
    createContent: require('./resolvers/createContent'),
    duplicateContent: require('./resolvers/duplicateContent'),
    deleteContent: require('./resolvers/deleteContent'),
    updateContent: require('./resolvers/updateContent'),
    updateContentVersion: require('./resolvers/contentVersion/update'),
    scheduleContent: require('./resolvers/scheduleContent'),
    unscheduleContent: require('./resolvers/unscheduleContent'),
    contentTemplates: require('./resolvers/contentTemplates'),
    contentTemplate: require('./resolvers/contentTemplate'),
    contentTemplateParts: require('./resolvers/contentTemplatePart/list'),
    contentTemplatePart: require('./resolvers/contentTemplatePart/get'),

    dimensionDelivStats: require('./resolvers/dimensionDelivStats'),

    getSettings: require('./resolvers/getSettings'),
    delivRouterStats: require('./resolvers/delivRouterStats'),

    contentIncome: require('./resolvers/income/get'),
    contentIncomes: require('./resolvers/income/list'),

    apiKeys: require('./resolvers/apiKeys'),
    getHistory: require('./resolvers/history/getHistory'),

    activationConfig: require('./resolvers/activation/getConfig'),
    activationConfigs: require('./resolvers/activation/getConfigs'),
    activationStats: require('./resolvers/activation/getStats'),

    getSuggestions: require('./resolvers/suggestion/getSuggestions')
  },
  Mutation: {
    createPartner: require('./resolvers/partner/create'),
    updatePartner: require('./resolvers/partner/update'),
    deletePartner: require('./resolvers/partner/delete'),

    createContent: require('./resolvers/createContentMutation'),

    createContentTemplate: require('./resolvers/createContentTemplate'),
    updateContentTemplate: require('./resolvers/updateContentTemplate'),
    duplicateContentTemplate: require('./resolvers/duplicateContentTemplate'),
    deleteContentTemplate: require('./resolvers/deleteContentTemplate'),

    createContentVersion: require('./resolvers/contentVersion/create'),
    updateContentVersion: require('./resolvers/contentVersion/update'),
    deleteContentVersion: require('./resolvers/contentVersion/delete'),
    cloneContentVersion: require('./resolvers/contentVersion/clone'),

    insertCodeInHtml: require('./resolvers/insertCodeInHtml'),

    createContentTemplatePart: require('./resolvers/contentTemplatePart/create'),
    updateContentTemplatePart: require('./resolvers/contentTemplatePart/update'),
    duplicateContentTemplatePart: require('./resolvers/contentTemplatePart/duplicate'),
    deleteContentTemplatePart: require('./resolvers/contentTemplatePart/delete'),

    updateSettings: require('./resolvers/updateSettings'),
    updateEncryptedSettings: require('./resolvers/updateEncryptedSettings'),

    updateContactSource: require('./resolvers/updateContactSource'),
    createContactSource: require('./resolvers/createContactSource'),
    enableChildSource: require('./resolvers/enableChildSource'),

    updateMailRouter: require('./resolvers/updateMailRouter'),
    createMailRouter: require('./resolvers/createMailRouter'),
    deleteMailRouter: require('./resolvers/deleteMailRouter'),

    updateSendingConfig: require('./resolvers/updateSendingConfig'),
    createSendingConfig: require('./resolvers/createSendingConfig'),
    deleteSendingConfig: require('./resolvers/deleteSendingConfig'),

    updateExclusionList: require('./resolvers/updateExclusionList'),
    createExclusionList: require('./resolvers/createExclusionList'),
    deleteExclusionList: require('./resolvers/deleteExclusionList'),
    uploadExclusionListFile: require('./resolvers/uploadExclusionListFile'),

    updateInclusionList: require('./resolvers/updateInclusionList'),
    createInclusionList: require('./resolvers/createInclusionList'),
    deleteInclusionList: require('./resolvers/deleteInclusionList'),
    uploadInclusionListFile: require('./resolvers/uploadInclusionListFile'),

    createSchedule: require('./resolvers/createSchedule'),
    updateSchedule: require('./resolvers/updateSchedule'),
    deleteSchedule: require('./resolvers/deleteSchedule'),

    unsubscribeContact: require('./resolvers/unsubscribeContact'),
    subscribeContact: require('./resolvers/subscribeContact'),

    updateContactMessage: require('./resolvers/updateContactMessage'),

    createContactMessageRule: require('./resolvers/createContactMessageRule'),
    updateContactMessageRule: require('./resolvers/updateContactMessageRule'),
    deleteContactMessageRule: require('./resolvers/deleteContactMessageRule'),

    sendContactMessage: require('./resolvers/sendContactMessage'),

    sendBat: require('./resolvers/bat/send'),
    createBat: require('./resolvers/bat/create'),
    updateBat: require('./resolvers/bat/update'),
    sendContentVersionTest: require('./resolvers/sendContentVersionTest'),

    exportContacts: require('./resolvers/exportContacts'),

    blacklistContact: require('./resolvers/blacklistContact'),
    blacklistContactWithFields: require('./resolvers/blacklistContactWithFields'),

    unblacklistContact: require('./resolvers/unblacklistContact'),
    unblacklist: require('./resolvers/unblacklist'),
    unblacklistWithFields: require('./resolvers/unblacklistWithFields'),
    removeContact: require('./resolvers/contact/remove'),

    updateSendingConfigScores: require('./resolvers/updateSendingConfigScores'),
    generateUploadUrl: require('./resolvers/generateUploadUrl'),

    createSender: require('./resolvers/sender/create'),
    updateSender: require('./resolvers/sender/update'),
    deleteSender: require('./resolvers/sender/delete'),

    createContentIncomes: require('./resolvers/income/create'),

    createApiKey: require('./resolvers/createApiKey'),
    deleteApiKey: require('./resolvers/deleteApiKey'),

    suspendContent: require('./resolvers/suspendContent'),
    markHistoryAsRead: require('./resolvers/history/markHistoryAsRead'),

    updateActivationConfig: require('./resolvers/activation/updateConfig'),
    updateSuggestion: require('./resolvers/suggestion/updateSuggestion'),
    updateContact: require('./resolvers/contact/update')
  },
  DateTime: DateTimeResolver,
  Contact: {
    inscriptions: require('./resolvers/contactInscriptions'),
    messages: require('./resolvers/contactMessages'),
    lastInscription: (contact) => contact.getLastInscription(),
    events: require('./resolvers/contactEvents')
  },
  ContactInscription: {
    contact: (contactInscription) => contactInscription.getContact(),
    source: (contactInscription) => contactInscription.getSource()
  },
  ContactMessage: {
    contact: (contactMessage) => contactMessage.getContact(),
    blacklistedContact: require('./resolvers/blacklistedContactWithFields')
  },
  ContactEvent: {
    contact: (contactEvent) => contactEvent.getContact(),
    sender: (contactEvent) => contactEvent.getSender(),
    source: (contactEvent) => contactEvent.getSource(),
    content: (contactEvent) => contactEvent.getContent(),
    schedule: (contactEvent) => contactEvent.getSchedule(),
    ipAddress: (contactEvent) => contactEvent.getIpAddress()
  },
  Content: {
    defaultVersion: (content) => content.getDefaultVersion(),
    versions: (content) => content.getVersions({ where: { archived: false }, order: [['id', 'ASC']] }),
    schedules: (content) => content.getSchedules(),
    bats: (content) => content.getBats(),
    dimensionDelivStats: require('./resolvers/dimensionDelivStats'),
    incomes: require('./resolvers/income/list'),
    partner: (content) => content.getPartner(),
    history: require('./resolvers/contentHistory'),
    externalStats: require('./resolvers/contentStats')
  },
  ContentVersion: {
    contentTemplate: (contentVersion) => contentVersion.getContentTemplate()
  },
  Schedule: {
    contactsCount: require('./resolvers/scheduleContactsCount'),
    sendingConfig: (schedule) => schedule.getSendingConfig(),
    dimensionDelivStats: require('./resolvers/dimensionDelivStats'),
    contents: require('./resolvers/contents')
  },
  Bat: {
    sendingConfig: (bat) => bat.getSendingConfig(),
    content: (bat) => bat.getContent(),
    partner: (bat) => bat.getPartner()
  },
  ExclusionList: {
    items: require('./resolvers/exclusionListsItems')
  },
  InclusionList: {
    items: require('./resolvers/inclusionListsItems')
  },
  Sender: {
    mailRouter: (sender) => sender.getMailRouter()
  },
  Partner: {
    bats: require('./resolvers/bat/list')
  },
  ContentIncome: {
    content: (contentIncome) => contentIncome.getContent()
  },
  ContactSource: {
    parentSource: (contactSource) => contactSource.getParentSource(),
    defaultChildSource: (contactSource) => contactSource.getDefaultChildSource(),
    childSources: (contactSource) => contactSource.getChildSources()
  },
  SendingConfig: {
    activityHistory: require('./resolvers/sendingConfigHistory')
  },
  ActivationConfig: {
    history: require('./resolvers/activation/history')
  }
};

module.exports = resolvers;
