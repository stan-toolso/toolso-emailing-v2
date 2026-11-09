import { CLink } from '@coreui/react';
import React, { useState } from 'react';
import Switch from 'react-switch';
import { canActivateContent, updateContent } from '../util';

export default ({ emailingDatabaseApiContext, item, fields, prefixName }) => {
  const [showFullLabel, setShowFullLabel] = useState(false);
  const [, setObjectToForceRefresh] = useState(null);

  return (
    <div style={{ height: showFullLabel ? 'auto' : `${fields.length * 19}px`, overflow: 'hidden', wordBreak: 'break-all', padding: '1px 2px', minWidth: '400px' }}>
      {item.dimension && item.dimension.object && (
        <div style={{ float: 'left', width: '40px' }}>
          <Switch
            onChange={(checked) => {
              updateContent(emailingDatabaseApiContext, item.dimension.object, { isActive: checked }, checked ? 'Content is enabled' : 'Content is disabled', () => {
                setObjectToForceRefresh({});
              });
            }}
            checked={item.dimension.object.isActive}
            disabled={!canActivateContent(item.dimension.object)}
            uncheckedIcon={false}
            checkedIcon={false}
            height={18}
            width={35}
          />
        </div>
      )}

      <span
        onClick={() => {
          setShowFullLabel(!showFullLabel);
        }}
      >
        {prefixName && <span>{prefixName} - </span>}
        {item.name}
      </span>

      <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/list/${item.id}`} target="_blank">
        <i className="fas fa-external-link-alt" style={{ paddingLeft: '7px', fontSize: '11px' }}></i>
      </CLink>
    </div>
  );
};
