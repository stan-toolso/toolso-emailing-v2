import React, { useContext } from 'react';
import { useHistory } from 'react-router-dom';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CDataTable } from '@coreui/react';
import moment from 'moment-timezone';

export default ({ templates, loading, cloneTemplate }) => {
  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <CDataTable
      items={loading ? null : templates}
      fields={['id', 'createdAt', 'name', 'subject', 'duplicate']}
      size="sm"
      addTableClasses="m-0"
      hover
      striped
      loading={loading}
      clickableRows
      onRowClick={(template) => history.push(`/${emailingDatabaseApiContext.getUid()}/contents/templates/${template.id}/`)}
      scopedSlots={{
        id: (template) => <td>{template.id}</td>,
        name: (template) => <td>{template.name}</td>,
        subject: (template) => <td>{template.subject ? template.subject : ''}</td>,
        createdAt: (template) => <td>{moment(template.createdAt).tz('Europe/Paris').format('YYYY/MM/DD HH:mm:ss')}</td>,
        duplicate: (template) => (
          <td>
            <i
              className="pl-2 pr-1 fas  fa-clone"
              style={{ cursor: 'pointer' }}
              onClick={(event) => {
                cloneTemplate(template);
                event.stopPropagation();
              }}
            ></i>
          </td>
        )
      }}
    />
  );
};
