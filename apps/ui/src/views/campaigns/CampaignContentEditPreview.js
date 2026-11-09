import React, { useEffect, useState } from 'react';

import ContentEditPreview from '../database/contents/edit/ContentEditPreview';
import { GET_CONTENT } from '../../services/DatabaseQuery';
import EmailingDatabaseApiContext from '../../contexts/EmailingDatabaseApiContext';

export default ({ emailingDatabaseApi, campaignContent }) => {
  const [content, setContent] = useState();

  useEffect(() => {
    (async () => {
      if (campaignContent) {
        let newContent = await getContentFromCampaignContent(emailingDatabaseApi, campaignContent);
        setContent(newContent);
      }
    })();
  }, [setContent, campaignContent, emailingDatabaseApi]);

  return (
    <>
      {emailingDatabaseApi && (
        <EmailingDatabaseApiContext.Provider value={emailingDatabaseApi}>
          <ContentEditPreview content={content} />
        </EmailingDatabaseApiContext.Provider>
      )}
    </>
  );
};

async function getContentFromCampaignContent(emailingDatabaseApiContext, campaignContent) {
  let result = await emailingDatabaseApiContext.doQuery({
    query: GET_CONTENT,
    variables: {
      id: campaignContent.content_id
    }
  });
  return result?.data?.content && JSON.parse(JSON.stringify(result.data.content));
}
