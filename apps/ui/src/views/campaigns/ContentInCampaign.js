import React from 'react';

import ContentEditDashboard from '../database/contents/edit/ContentEditDashboard';
import ContentEditSettings from '../database/contents/edit/ContentEditSettings';
import ContentEditTemplates from '../database/contents/edit/ContentEditTemplates';
import ContentEditSchedules from '../database/contents/edit/ContentEditSchedules';
import ContentEditBats from '../database/contents/edit/ContentEditBats';

export default ({ content, forceUpdate, wantedSection, emailingDatabaseApi }) => {
  return (
    <>
      {wantedSection === 'dashboard' && (
        <>
          <ContentEditDashboard content={content} forceUpdate={forceUpdate} />
        </>
      )}
      {wantedSection === 'settings' && (
        <>
          <ContentEditSettings content={content} forceUpdate={forceUpdate} emailingDatabaseApi={emailingDatabaseApi} />
        </>
      )}
      {wantedSection === 'templates' && (
        <>
          <ContentEditTemplates content={content} forceUpdate={forceUpdate} />
        </>
      )}
      {wantedSection === 'schedules' && (
        <>
          <ContentEditSchedules content={content} forceUpdate={forceUpdate} emailingDatabaseApi={emailingDatabaseApi} />
        </>
      )}
      {wantedSection === 'bats' && (
        <>
          <ContentEditBats content={content} forceUpdate={forceUpdate} />
        </>
      )}
    </>
  );
};
