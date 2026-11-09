import React, { useCallback, useContext, useState } from 'react';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CInput, CLink, CSpinner } from '@coreui/react';

const DEFAULT_CELL_STYLE = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };

export default ({ blacklistedContacts, loading, filter, setFilter }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        setFilter(JSON.parse(JSON.stringify(filter)));
      }
    },
    [filter, setFilter]
  );

  const [email, setEmail] = useState('');
  const [sha1, setSha1] = useState('');
  const [sha256, setSha256] = useState('');
  const [md5, setMd5] = useState('');

  return (
    <div className="responsive-table">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Id</th>
            <th>Email</th>
            <th>Md5</th>
            <th>Sha1</th>
            <th>Sha256</th>
          </tr>
        </thead>
        {filter && setFilter && (
          <tbody>
            <tr>
              <td></td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    filter.email = e.target.value;
                    setEmail(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Md5"
                  value={md5}
                  onChange={(e) => {
                    filter.md5 = e.target.value;
                    setMd5(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Sha1"
                  value={sha1}
                  onChange={(e) => {
                    filter.sha1 = e.target.value;
                    setSha1(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
              <td>
                <CInput
                  size="sm"
                  placeholder="Sha256"
                  value={sha256}
                  onChange={(e) => {
                    filter.sha256 = e.target.value;
                    setSha256(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                ></CInput>
              </td>
            </tr>
          </tbody>
        )}
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4}>
                <div style={{ textAlign: 'center', height: '160px' }}>
                  <CSpinner animation="grow" color="secondary" style={{ margin: 'auto' }} />
                </div>
              </td>
            </tr>
          )}
          {!loading && blacklistedContacts.length === 0 && (
            <tr>
              <td colSpan={4}>
                <div className="text-center w-100">... No data for this selection ...</div>
              </td>
            </tr>
          )}
          {!loading &&
            blacklistedContacts.map((blacklistedContact, index) => {
              return (
                <tr key={index}>
                  <td>
                    <CLink to={`/${emailingDatabaseApiContext.getUid()}/contacts/blacklist/${blacklistedContact.id}`}>#{blacklistedContact.id}</CLink>
                  </td>
                  <td>
                    <div style={{ ...DEFAULT_CELL_STYLE, width: '200px' }}>{blacklistedContact.email}</div>
                  </td>
                  <td>
                    <div>{blacklistedContact.md5}</div>
                  </td>
                  <td>
                    <div>{blacklistedContact.sha1}</div>
                  </td>
                  <td>
                    <div>{blacklistedContact.sha256}</div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};
