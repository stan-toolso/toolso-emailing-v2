import React, { useContext, useState, useEffect } from 'react';
import { CCol, CFormGroup, CRow, CSelect } from '@coreui/react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import Mustache from 'mustache';
import { useSettings } from '../../../common/Settings';

export default ({ content }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  let initialContentVersion = content && content.versions.length > 0 ? content.versions[0] : null;
  const [contentVersion, setContentVersion] = useState();
  const [needToShowPreview, setNeedToShowPreview] = useState(currentVersionHasHtml(content, initialContentVersion?.id));
  const [canEditSenderName] = useSettings('canEditSenderName');

  useEffect(() => {
    let initialContentVersion = content && content.versions.length > 0 ? content.versions[0] : null;
    setContentVersion(initialContentVersion);
  }, [setContentVersion, content]);

  useEffect(() => {
    (async () => {
      if (contentVersion) {
        let futureNeedToShowPreview = currentVersionHasHtml(content, contentVersion?.id);
        setNeedToShowPreview(futureNeedToShowPreview);
      }
    })();
  }, [setNeedToShowPreview, content, contentVersion]);

  if (!content || !contentVersion) {
    return null;
  }

  return (
    <>
      {content && content.versions && content.versions.length > 1 && (
        <CRow>
          <CCol xl={12} style={{ borderBottom: '1px solid #c8ced3' }}>
            <CFormGroup>
              <CSelect
                size="sm"
                value={contentVersion ? contentVersion.id : null}
                onChange={(event) => {
                  for (let v of content.versions) {
                    if (v.id === event.target.value) {
                      setContentVersion(v);
                    }
                  }
                }}
              >
                <option value=""> -- Select your version --</option>
                {content.versions.map((item, index) => {
                  return (
                    <option key={index} value={item.id}>
                      #{item.id} - {item.name}
                    </option>
                  );
                })}
              </CSelect>
            </CFormGroup>
          </CCol>
        </CRow>
      )}
      <CRow>
        <CCol xl={12}>
          <div className="pb-2" style={{ borderBottom: '1px solid #c8ced3' }}>
            {canEditSenderName && (
              <>
                <div style={{ fontWeight: 'bold' }}>Sender name (not used for french esps)</div>
                <div className="mb-2">
                  {contentVersion.contentTemplate
                    ? Mustache.render(contentVersion.contentTemplate.senderName ? contentVersion.contentTemplate.senderName : '', { content: contentVersion.templateVariables })
                    : contentVersion.senderName}
                </div>
              </>
            )}
            <div style={{ fontWeight: 'bold' }}>Subject</div>

            {contentVersion.contentTemplate
              ? Mustache.render(contentVersion.contentTemplate.subject ? contentVersion.contentTemplate.subject : '', { content: contentVersion.templateVariables })
              : contentVersion.subject}

            {canEditSenderName && (
              <>
                <div style={{ fontWeight: 'bold' }}>French Esps Subject</div>
                {contentVersion.contentTemplate
                  ? Mustache.render(contentVersion.contentTemplate.subject ? contentVersion.contentTemplate.subject : '', { content: contentVersion.templateVariables })
                  : contentVersion.subject}
              </>
            )}
          </div>
        </CCol>
        {needToShowPreview && (
          <CCol xl={12}>
            <iframe
              style={{ width: '100%', border: 'none', height: '400px' }}
              title="Preview"
              src={emailingDatabaseApiContext.buildUrl(`/content/${content.id}/version/${contentVersion.id}/preview?ts=${new Date().getTime()}`)}
            ></iframe>
          </CCol>
        )}
      </CRow>
    </>
  );
};

const currentVersionHasHtml = (content, versionid) => {
  if (content && content.versions && versionid) {
    var version = content.versions.find((version) => version.id === versionid);
    if (version?.html || version?.contentTemplate) {
      return true;
    }
  }
  return false;
};
