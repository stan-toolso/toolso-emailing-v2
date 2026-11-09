import { CBadge, CInput, CLink, CSelect, CSpinner } from '@coreui/react';
import { gql, useQuery } from '@apollo/client';
import React, { useContext, useEffect, useState } from 'react';
import Pagination from '../../../common/Pagination';
import moment from 'moment-timezone';
import Switch from 'react-switch';
import { getBatStatusBadge } from './util';
import { updateContent, canActivateContent } from '../util';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default ({ partnerId }) => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ partnerId });
  const [bats, setBats] = useState([]);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);

  const { data, loading } = useQuery(
    gql`
      query bats($limit: Int, $offset: Int, $filter: JSON) {
        bats(limit: $limit, offset: $offset, filter: $filter) {
          total
          bats {
            id
            date
            content {
              id
              name
              isActive
              suspended
            }
            status
            validatorsEmails
          }
        }
      }
    `,
    {
      variables: {
        limit: limit,
        offset: offset,
        filter: filter
      }
    }
  );

  useEffect(() => {
    if (data) {
      setTotal(data.bats.total);
      setBats(JSON.parse(JSON.stringify(data.bats.bats)));
    }
  }, [setTotal, data, setBats]);

  return (
    <>
      <div className="mb-0 p-2" style={{ height: '50px' }}>
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
      </div>

      <table className="table table-sm">
        <thead>
          <tr>
            <th>
              <div style={{ width: '50px' }}>ID</div>
            </th>
            <th>
              <div style={{ width: '150px' }}>Date</div>
            </th>
            <th style={{ width: '100%' }}>
              <div style={{ width: '100%' }}>Content</div>
            </th>
            <th>
              <div style={{ width: '150px' }}>Recipient</div>
            </th>
            <th>
              <div style={{ width: '70px' }}>Status</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <td></td>
            <td>
              {' '}
              <CInput
                value={filter.contentName ? filter.contentName : ''}
                onChange={(event) => {
                  setFilter({
                    ...filter,
                    contentName: event.target.value
                  });
                }}
                className="form-control"
                size="sm"
              />
            </td>
            <td>
              {' '}
              <CInput
                value={filter.validatorsEmails ? filter.validatorsEmails : ''}
                onChange={(event) => {
                  setFilter({
                    ...filter,
                    validatorsEmails: event.target.value
                  });
                }}
                className="form-control"
                size="sm"
              />
            </td>
            <td>
              <CSelect
                style={{ display: 'inline-block', width: '110px' }}
                className="form-control mr-2"
                size="sm"
                onChange={(event) => {
                  setFilter({
                    ...filter,
                    status: event.target.value
                  });
                }}
                value={filter.status ? filter.status : ''}
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="waiting">Waiting</option>
                <option value="validated">Validated</option>
                <option value="rejected">Rejected</option>
              </CSelect>
            </td>
          </tr>
        </tbody>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={5}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && bats && bats.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={5}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>No result</div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && bats && bats.length > 0 && (
          <tbody>
            {bats.map((bat) => {
              return (
                <tr key={bat.id}>
                  <td>{bat.id}</td>
                  <td>{moment(bat.date).format('YYYY-MM-DD HH:mm:ss')}</td>

                  <td>
                    {bat.content && (
                      <>
                        <span
                          style={{
                            marginTop: '3px',
                            display: 'inline-block',
                            float: 'left',
                            height: '19px',
                            marginRight: '4px'
                          }}
                        >
                          <Switch
                            onChange={(checked) => {
                              updateContent(emailingDatabaseApiContext, bat.content, { isActive: checked }, checked ? 'Content is enabled' : 'Content is disabled', () => {
                                setBats([...bats]);
                              });
                            }}
                            checked={bat.content.isActive}
                            disabled={!canActivateContent(bat.content)}
                            uncheckedIcon={false}
                            checkedIcon={false}
                            height={18}
                            width={35}
                          />
                        </span>
                        <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/list/${bat.content.id}/bats/`}> {bat.content.name}</CLink>
                      </>
                    )}
                  </td>

                  <td>{bat.validatorsEmails}</td>
                  <td>
                    <CBadge color={getBatStatusBadge(bat.status)}>{bat.status}</CBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>

      <div className="mb-0 p-2">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </>
  );
};
