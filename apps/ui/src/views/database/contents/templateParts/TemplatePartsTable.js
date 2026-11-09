import React, { useContext } from 'react';
import { useHistory } from 'react-router-dom';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CDataTable } from '@coreui/react';
import moment from 'moment-timezone';

export default ({ items, loading }) => {
  const history = useHistory();
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  return (
    <CDataTable
      items={loading ? null : items}
      fields={['id', 'createdAt', 'uid', 'name']}
      size="sm"
      addTableClasses="m-0"
      hover
      striped
      loading={loading}
      clickableRows
      onRowClick={(item) => history.push(`/${emailingDatabaseApiContext.getUid()}/contents/template_parts/${item.id}/`)}
      scopedSlots={{
        id: (item) => <td>{item.id}</td>,

        uid: (item) => <td>{item.uid ? item.uid : ''}</td>,
        createdAt: (item) => <td>{moment(item.createdAt).tz('Europe/Paris').format('YYYY/MM/DD HH:mm:ss')}</td>
      }}
    />
  );
};
