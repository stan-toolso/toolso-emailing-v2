module.exports = (sequelize) => {
  const {
    Contact,
    ContactEvents,
    ContactSource,
    ContactInscription,
    ContactEvent,
    ContactMessage,
    Sender,
    IpAddress,
    MailRouter,
    ContactEventStats,
    ContactEventStatsAggregate,
    Schedule,
    Content,
    SendingConfig,
    ContentVersion,
    ContentTemplate,
    ContactContent,
    ExclusionList,
    ExclusionListItem,
    InclusionList,
    InclusionListItem,
    Bat,
    Partner,
    SendingStrategiesScheduleStats,
    ContentIncome,
    ContentStats
  } = sequelize.models;

  ContactInscription.belongsTo(ContactSource, {
    as: 'source',
    foreignKey: 'sourceId'
  });

  Contact.belongsTo(ContactInscription, {
    as: 'lastInscription',
    foreignKey: 'lastInscriptionId',
    constraints: false
  });
  Contact.belongsTo(ContactSource, {
    as: 'lastSource',
    foreignKey: 'lastSourceId',
    constraints: false
  });
  Contact.hasMany(ContactInscription, {
    as: 'inscriptions',
    foreignKey: { name: 'contactId', allowNull: false }
  });
  ContactInscription.belongsTo(Contact, {
    as: 'contact',
    foreignKey: { name: 'contactId', allowNull: false }
  });

  ContactEvents.belongsTo(Contact, {
    as: 'contact',
    foreignKey: { name: 'contactId', allowNull: false }
  });
  Contact.hasOne(ContactEvents, {
    as: 'cachedEvents',
    foreignKey: { name: 'contactId', allowNull: false },
    onDelete: 'CASCADE'
  });

  ContactMessage.belongsTo(Contact, { as: 'contact', foreignKey: 'contactId' });
  Contact.hasMany(ContactMessage, {
    as: 'messages',
    foreignKey: { name: 'contactId', allowNull: false }
  });

  Sender.belongsTo(MailRouter, {
    as: 'mailRouter',
    foreignKey: 'mailRouterId'
  });

  ContactEvent.belongsTo(Contact, {
    as: 'contact',
    foreignKey: { name: 'contactId', allowNull: false },
    onDelete: 'CASCADE'
  });
  ContactEvent.belongsTo(Sender, { as: 'sender', foreignKey: 'senderId' });
  ContactEvent.belongsTo(IpAddress, {
    as: 'ipAddress',
    foreignKey: 'ipAddressId'
  });
  ContactEvent.belongsTo(ContactSource, {
    as: 'source',
    foreignKey: 'sourceId'
  });
  ContactEvent.belongsTo(ContactInscription, {
    as: 'inscription',
    foreignKey: 'inscriptionId'
  });
  ContactEvent.belongsTo(Content, { as: 'content', foreignKey: 'contentId' });
  ContactEvent.belongsTo(ContentVersion, {
    as: 'contentVersion',
    foreignKey: 'contentVersionId'
  });
  ContactEvent.belongsTo(Schedule, {
    as: 'schedule',
    foreignKey: 'scheduleId'
  });

  Contact.hasMany(ContactEvent, {
    as: 'events',
    foreignKey: 'contactId',
    onDelete: 'CASCADE'
  });

  Bat.belongsTo(Content, { as: 'content', foreignKey: 'contentId' });
  Content.hasMany(Bat, {
    as: 'bats',
    foreignKey: 'contentId',
    onDelete: 'CASCADE'
  });
  Bat.belongsTo(SendingConfig, {
    as: 'sendingConfig',
    foreignKey: 'sendingConfigId'
  });

  Bat.belongsTo(Partner, { as: 'partner', foreignKey: 'partnerId' });
  Content.belongsTo(Partner, { as: 'partner', foreignKey: 'partnerId' });

  ContactEventStats.belongsTo(Sender, { as: 'sender', foreignKey: 'senderId' });
  ContactEventStats.belongsTo(Content, {
    as: 'content',
    foreignKey: 'contentId'
  });
  ContactEventStats.belongsTo(ContentVersion, {
    as: 'contentVersion',
    foreignKey: 'contentVersionId'
  });
  ContactEventStats.belongsTo(IpAddress, {
    as: 'ipAddress',
    foreignKey: 'ipAddressId'
  });
  ContactEventStats.belongsTo(ContactSource, {
    as: 'source',
    foreignKey: 'sourceId'
  });
  ContactEventStats.belongsTo(Schedule, {
    as: 'schedule',
    foreignKey: 'scheduleId'
  });

  ContactEventStatsAggregate.belongsTo(Sender, {
    as: 'sender',
    foreignKey: 'senderId'
  });
  ContactEventStatsAggregate.belongsTo(Content, {
    as: 'content',
    foreignKey: 'contentId'
  });
  ContactEventStatsAggregate.belongsTo(ContentVersion, {
    as: 'contentVersion',
    foreignKey: 'contentVersionId'
  });
  ContactEventStatsAggregate.belongsTo(IpAddress, {
    as: 'ipAddress',
    foreignKey: 'ipAddressId'
  });
  ContactEventStatsAggregate.belongsTo(ContactSource, {
    as: 'source',
    foreignKey: 'sourceId'
  });
  ContactEventStatsAggregate.belongsTo(Schedule, {
    as: 'schedule',
    foreignKey: 'scheduleId'
  });

  Content.hasMany(ContentVersion, {
    as: 'versions',
    foreignKey: 'contentId',
    onDelete: 'CASCADE'
  });
  ContentVersion.belongsTo(Content, { as: 'content', foreignKey: 'contentId' });
  ContentVersion.belongsTo(ContentTemplate, {
    as: 'contentTemplate',
    foreignKey: 'contentTemplateId'
  });
  Content.belongsTo(ContentVersion, {
    as: 'defaultVersion',
    foreignKey: 'defaultVersionId',
    constraints: false
  });

  Content.belongsToMany(Schedule, {
    as: 'schedules',
    through: 'ContentSchedule',
    foreignKey: 'contentId'
  });
  Schedule.belongsToMany(Content, {
    as: 'contents',
    through: 'ContentSchedule',
    foreignKey: 'scheduleId'
  });

  Schedule.belongsTo(SendingConfig, {
    as: 'sendingConfig',
    foreignKey: 'sendingConfigId'
  });
  Schedule.belongsTo(Schedule, { as: 'parent', foreignKey: 'parentId' });

  ContactContent.belongsTo(Contact, { as: 'contact', foreignKey: 'contactId' });
  ContactContent.belongsTo(Sender, { as: 'sender', foreignKey: 'senderId' });
  ContactContent.belongsTo(Schedule, {
    as: 'schedule',
    foreignKey: 'scheduleId'
  });
  ContactContent.belongsTo(Schedule, {
    as: 'parentSchedule',
    foreignKey: 'parentScheduleId'
  });
  ContactContent.belongsTo(Content, { as: 'content', foreignKey: 'contentId' });
  ContactContent.belongsTo(ContentVersion, {
    as: 'contentVersion',
    foreignKey: 'contentVersionId'
  });

  ContactContent.belongsTo(IpAddress, {
    as: 'ipAddress',
    foreignKey: 'ipAddressId'
  });
  ContactContent.belongsTo(ContactSource, {
    as: 'source',
    foreignKey: 'sourceId'
  });
  ContactContent.belongsTo(ContactInscription, {
    as: 'inscription',
    foreignKey: 'inscriptionId'
  });

  Contact.hasMany(ContactContent, {
    as: 'contactContents',
    foreignKey: 'contactId'
  });

  ExclusionList.hasMany(ExclusionListItem, {
    as: 'items',
    foreignKey: 'exclusionListId',
    onDelete: 'cascade'
  });
  ExclusionListItem.belongsTo(ExclusionList, {
    as: 'exclusionList',
    foreignKey: 'exclusionListId'
  });

  InclusionList.hasMany(InclusionListItem, {
    as: 'items',
    foreignKey: 'inclusionListId',
    onDelete: 'cascade'
  });
  InclusionListItem.belongsTo(InclusionList, {
    as: 'inclusionList',
    foreignKey: 'inclusionListId'
  });

  SendingStrategiesScheduleStats.belongsTo(Schedule, {
    as: 'schedule',
    foreignKey: { name: 'scheduleId', allowNull: false }
  });

  ContentIncome.belongsTo(Content, {
    as: 'content',
    foreignKey: { name: 'contentId', allowNull: false }
  });

  ContactSource.belongsTo(ContactSource, {
    as: 'parentSource',
    foreignKey: 'parentSourceId'
  });

  ContactSource.belongsTo(ContactSource, {
    as: 'defaultChildSource',
    foreignKey: 'defaultChildSourceId'
  });

  ContactSource.hasMany(ContactSource, {
    as: 'childSources',
    foreignKey: 'parentSourceId'
  });

  Content.hasOne(ContentStats, {
    as: 'externalStats',
    foreignKey: { name: 'content_id' }
  });
};
