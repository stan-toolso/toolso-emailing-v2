import { lazy } from 'react';

const DatabaseDashboard = lazy(() => import('./views/database/home/DatabaseDashboard.js'));
const InscriptionListCard = lazy(() => import('./views/database/contacts/inscriptions/InscriptionListCard.js'));
const InscriptionDetail = lazy(() => import('./views/database/contacts/inscriptions/InscriptionDetail.js'));
const InscriptionActivation = lazy(() => import('./views/database/contacts/inscriptions/InscriptionActivation.js'));

const MessageListCard = lazy(() => import('./views/database/contacts/messages/MessageListCard.js'));
const MessageDetail = lazy(() => import('./views/database/contacts/messages/MessageDetail.js'));

const MessageRuleListCard = lazy(() => import('./views/database/contacts/messages/rules/MessageRuleListCard'));
const MessageRuleDetail = lazy(() => import('./views/database/contacts/messages/rules/MessageRuleDetail.js'));

const Sources = lazy(() => import('./views/database/contacts/sources/Sources.js'));
const SourceEdit = lazy(() => import('./views/database/contacts/sources/SourceEdit.js'));

const Esps = lazy(() => import('./views/database/contacts/inscriptions/Esps.js'));

const ContactDashboard = lazy(() => import('./views/database/contacts/ContactDashboard.js'));
const ContactStats = lazy(() => import('./views/database/contacts/stats/ContactStats.js'));
const ContactList = lazy(() => import('./views/database/contacts/ContactList.js'));
const ContactDetail = lazy(() => import('./views/database/contacts/ContactDetail.js'));
const ContactEventList = lazy(() => import('./views/database/contacts/events/ContactEventList.js'));
const ContactEventDetail = lazy(() => import('./views/database/contacts/events/ContactEventDetail.js'));

const BlacklistedContactList = lazy(() => import('./views/database/contacts/blacklistContacts/BlacklistedContactList'));
const BlacklistedContactDetail = lazy(() => import('./views/database/contacts/blacklistContacts/BlacklistedContactDetail'));

const ExclusionLists = lazy(() => import('./views/database/contacts/exclusionLists/ExclusionLists'));
const ExclusionList = lazy(() => import('./views/database/contacts/exclusionLists/ExclusionList'));

const ActivationStats = lazy(() => import('./views/database/contacts/activation/ActivationStats'));
const ActivationConfigs = lazy(() => import('./views/database/contacts/activation/ActivationConfigs'));

const InclusionLists = lazy(() => import('./views/database/contacts/inclusionLists/InclusionLists'));
const InclusionList = lazy(() => import('./views/database/contacts/inclusionLists/InclusionList'));

const ContentsDashboard = lazy(() => import('./views/database/contents/dashboard/ContentsDashboard.js'));
const ContentsAll = lazy(() => import('./views/database/contents/list/ContentsAll.js'));
const ContentEdit = lazy(() => import('./views/database/contents/edit/ContentEdit.js'));
const ContentTemplatesAll = lazy(() => import('./views/database/contents/templates/ContentTemplatesAll.js'));
const ContentTemplateEdit = lazy(() => import('./views/database/contents/templates/ContentTemplateEdit.js'));

const ContentTemplatePartsAll = lazy(() => import('./views/database/contents/templateParts/ContentTemplatePartsAll.js'));
const ContentTemplatePartEdit = lazy(() => import('./views/database/contents/templateParts/ContentTemplatePartEdit.js'));

const DelivDashboard = lazy(() => import('./views/database/sendings/deliv/DelivDashboard'));

const SendingsSettings = lazy(() => import('./views/database/sendings/settings/SendingsSettings'));
const Schedules = lazy(() => import('./views/database/sendings/schedules/Schedules'));

const SendingsDashboard = lazy(() => import('./views/database/sendings/SendingsDashboard'));

const Bats = lazy(() => import('./views/database/contents/bats/Bats'));
const Stats = lazy(() => import('./views/database/contents/stats/Stats'));
const Incomes = lazy(() => import('./views/database/contents/incomes/Incomes'));

const Partners = lazy(() => import('./views/database/contents/partners/Partners'));
const PartnerEdit = lazy(() => import('./views/database/contents/partners/PartnerEdit'));
const ContentSuggestions = lazy(() => import('./views/database/contents/suggestions/Suggestions'));
const ApiKeys = lazy(() => import('./views/database/home/ApiKeys'));
const History = lazy(() => import('./views/database/home/History'));
const Suggestions = lazy(() => import('./views/database/home/Suggestions'));

const SettingsEditor = lazy(() => import('./views/database/admin/SettingsEditor'));
const Deliverability = lazy(() => import('./views/database/admin/Deliverability.js'));
const Activation = lazy(() => import('./views/database/admin/Activation.js'));

const routes = [
  { path: '/:database_uid/', exact: true, name: 'DatabaseDashboard', component: DatabaseDashboard },

  { path: '/:database_uid/admin/settings', exact: true, name: 'AdminSettingsEditorView', component: SettingsEditor },
  { path: '/:database_uid/admin/settings/:section', exact: true, name: 'AdminSettingsEditorView', component: SettingsEditor },
  { path: '/:database_uid/admin/delivrability', exact: true, name: 'Deliverability', component: Deliverability },
  { path: '/:database_uid/admin/activation', exact: true, name: 'Activation', component: Activation },
  { path: '/:database_uid/admin/', exact: true, name: 'Deliverability', component: Deliverability },

  { path: '/:database_uid/contacts/', exact: true, name: 'ContactDashboard', component: ContactDashboard },
  { path: '/:database_uid/contacts/stats', exact: true, name: 'ContactStats', component: ContactStats },
  { path: '/:database_uid/contacts/stats/:section', name: 'ContactStats', component: ContactStats },
  { path: '/:database_uid/contacts/list', exact: true, name: 'ContactList', component: ContactList },
  { path: '/:database_uid/contacts/list/:contact_id', name: 'ContactDetail', component: ContactDetail },

  { path: '/:database_uid/contacts/exclusionLists', exact: true, name: 'ExclusionLists', component: ExclusionLists },
  { path: '/:database_uid/contacts/exclusionLists/:list_id', name: 'ExclusionList', component: ExclusionList },

  { path: '/:database_uid/contacts/inclusionLists', exact: true, name: 'InclusionLists', component: InclusionLists },
  { path: '/:database_uid/contacts/inclusionLists/:list_id', name: 'InclusionList', component: InclusionList },

  { path: '/:database_uid/contacts/events/list', exact: true, name: 'ContactEventList', component: ContactEventList },
  { path: '/:database_uid/contacts/events/list/:event_id', name: 'ContactEventDetail', component: ContactEventDetail },

  { path: '/:database_uid/contacts/blacklist', exact: true, name: 'BlacklistedContactList', component: BlacklistedContactList },
  { path: '/:database_uid/contacts/blacklist/:id', exact: true, name: 'BlacklistedContactDetail', component: BlacklistedContactDetail },

  { path: '/:database_uid/contacts/inscriptions/list', exact: true, name: 'InscriptionListCard', component: InscriptionListCard },
  { path: '/:database_uid/contacts/inscriptions/list/:inscription_id', name: 'InscriptionDetail', component: InscriptionDetail },
  { path: '/:database_uid/contacts/inscriptions/activation', exact: true, name: 'InscriptionActivation', component: InscriptionActivation },
  { path: '/:database_uid/contacts/inscriptions/sources', exact: true, name: 'Sources', component: Sources },
  { path: '/:database_uid/contacts/inscriptions/sources/edit/:source_id', exact: true, name: 'SourceEdit', component: SourceEdit },
  { path: '/:database_uid/contacts/inscriptions/sources/edit/:source_id/:section', exact: true, name: 'SourceEdit', component: SourceEdit },

  { path: '/:database_uid/contacts/inscriptions/esps', exact: true, name: 'Esps', component: Esps },

  { path: '/:database_uid/contacts/activation/', exact: true, name: 'ActivationStats', component: ActivationStats },
  { path: '/:database_uid/contacts/activation/configs', exact: true, name: 'ActivationConfigs', component: ActivationConfigs },

  { path: '/:database_uid/contacts/messages/list', exact: true, name: 'MessageListCard', component: MessageListCard },
  { path: '/:database_uid/contacts/messages/list/:message_id', name: 'messageDetail', component: MessageDetail },
  { path: '/:database_uid/contacts/messages/rules/list', exact: true, name: 'MessageRuleListCard', component: MessageRuleListCard },
  { path: '/:database_uid/contacts/messages/rules/list/:rule_id', name: 'MessageRuleDetail', component: MessageRuleDetail },

  { path: '/:database_uid/contents/list', exact: true, name: 'ContentsAll', component: ContentsAll },
  { path: '/:database_uid/contents/list/:content_id', exact: true, name: 'ContentEdit', component: ContentEdit },
  { path: '/:database_uid/contents/list/:content_id/:section', exact: true, name: 'ContentEdit', component: ContentEdit },
  { path: '/:database_uid/contents/templates/', exact: true, name: 'ContentTemplatesAll', component: ContentTemplatesAll },
  { path: '/:database_uid/contents/templates/:content_template_id', exact: true, name: 'ContentTemplateEdit', component: ContentTemplateEdit },
  { path: '/:database_uid/contents/template_parts/', exact: true, name: 'ContentTemplatePartsAll', component: ContentTemplatePartsAll },
  { path: '/:database_uid/contents/template_parts/:content_template_part_id', exact: true, name: 'ContentTemplatePartEdit', component: ContentTemplatePartEdit },

  { path: '/:database_uid/contents/partners/', exact: true, name: 'PartnersAll', component: Partners },
  { path: '/:database_uid/contents/partners/:partner_id', exact: true, name: 'PartnerEdit', component: PartnerEdit },
  { path: '/:database_uid/contents/partners/:partner_id/:section', exact: true, name: 'PartnerEdit', component: PartnerEdit },

  { path: '/:database_uid/contents/bats/', exact: true, name: 'Bats', component: Bats },
  { path: '/:database_uid/contents/stats/', exact: true, name: 'Stats', component: Stats },
  { path: '/:database_uid/contents/stats/:section', exact: true, name: 'Stats', component: Stats },
  { path: '/:database_uid/contents/incomes/', exact: true, name: 'Incomes', component: Incomes },
  { path: '/:database_uid/ByObjectSender', redirect: '/:database_uid/contents/stats/byObjectSender', exact: true, name: 'Stats', component: Stats },
  { path: '/:database_uid/ByContent', redirect: '/:database_uid/contents/stats/byContent', exact: true, name: 'Stats', component: Stats },
  { path: '/:database_uid/contents/partners/', exact: true, name: 'Partners', component: Partners },
  { path: '/:database_uid/contents/suggestions/', exact: true, name: 'Suggestions', component: ContentSuggestions },
  { path: '/:database_uid/contents/:section', exact: false, name: 'ContentsDashboard', component: ContentsDashboard },
  { path: '/:database_uid/contents/', exact: true, name: 'ContentsDashboard', component: ContentsDashboard },

  { path: '/:database_uid/sendings/deliv', exact: true, name: 'DelivDashboard', component: DelivDashboard },
  { path: '/:database_uid/sendings/settings', exact: true, name: 'SendingsSettings', component: SendingsSettings },
  { path: '/:database_uid/sendings/settings/:section', exact: true, name: 'SendingsSettings', component: SendingsSettings },
  { path: '/:database_uid/sendings/schedules/:section/:schedule_id', exact: false, name: 'Schedules', component: Schedules },
  { path: '/:database_uid/sendings/schedules/:section', exact: false, name: 'Schedules', component: Schedules },
  { path: '/:database_uid/sendings/schedules', exact: false, name: 'Schedules', component: Schedules },
  { path: '/:database_uid/sendings/', exact: true, name: 'SendingsDashboard', component: SendingsDashboard },
  { path: '/:database_uid/api_keys/', exact: true, name: 'ApiKeys', component: ApiKeys },
  { path: '/:database_uid/history/', exact: true, name: 'History', component: History },
  { path: '/:database_uid/suggestions/:suggestion_id', exact: true, name: 'Suggestions', component: Suggestions },
  { path: '/:database_uid/suggestions/', exact: true, name: 'Suggestions', component: Suggestions },
  { path: '/:database_uid/:section', redirect: '/:database_uid/', exact: true, name: 'DatabaseDashboard', component: DatabaseDashboard }
];

export default routes;
