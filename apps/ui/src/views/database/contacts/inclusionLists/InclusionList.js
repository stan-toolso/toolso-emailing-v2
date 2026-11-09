import { gql, useMutation, useQuery } from '@apollo/client';
import { CBadge, CButton, CCard, CCardBody, CCardFooter, CCardHeader, CCol, CFormGroup, CInput, CLabel, CProgress, CRow, CSelect, CSpinner } from '@coreui/react';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import moment from 'moment-timezone';
import { calculatePercent, formatInteger } from '../../../common/util';
import { confirmAlert } from 'react-confirm-alert'; // Import
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { useHistory } from 'react-router-dom';
import Pagination from '../../../common/Pagination';
import ReactS3Uploader from 'react-s3-uploader';
import { toast } from 'react-toastify';

export default ({ match }) => {
  const inclusionListId = match.params.list_id;

  const [name, setName] = useState('');
  const [field, setField] = useState('md5');

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);

  const [uploadStatus, setUploadStatus] = useState(null);

  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();

  const { data, loading, refetch } = useQuery(
    gql`
      query inclusionList($id: ID!, $limit: Int, $offset: Int, $filter: JSON) {
        inclusionList(id: $id) {
          id
          name
          field
          stats
          uploadStatus
          updatedAt
          createdAt
          items(limit: $limit, offset: $offset, filter: $filter) {
            total
            inclusionListItems {
              id
              value
            }
          }
        }
      }
    `,
    {
      variables: {
        id: inclusionListId,
        limit: limit,
        offset: offset,
        filter: {}
      }
    }
  );

  const startRefetch = useCallback(
    async (maxTs) => {
      let refetchResult = await refetch();
      if (new Date().getTime() > maxTs) {
        console.log('Timeout:' + maxTs);
        return;
      }
      if (refetchResult.data.inclusionList && refetchResult.data.inclusionList.uploadStatus && ['done', 'failed'].includes(refetchResult.data.inclusionList.uploadStatus.status)) {
        console.log('Bad stats:' + refetchResult.data.inclusionList.uploadStatus);
        return;
      }
      setTimeout(() => {
        startRefetch(maxTs);
      }, 1500);
    },
    [refetch]
  );
  useEffect(() => {
    if (data) {
      setName(data.inclusionList.name);
      setField(data.inclusionList.field);
      if (data.inclusionList.items) {
        setTotal(data.inclusionList.items.total);
        setItems(data.inclusionList.items.inclusionListItems);
      }
    }
  }, [data, setName, setField, setItems]);

  const [updateInclusionList, { loading: saving }] = useMutation(gql`
    mutation updateInclusionList($inclusionList: JSON!) {
      updateInclusionList(inclusionList: $inclusionList) {
        id
      }
    }
  `);

  const [uploadInclusionListFile] = useMutation(gql`
    mutation uploadInclusionListFile($inclusionListId: ID!, $s3Key: String!, $fileName: String!) {
      uploadInclusionListFile(inclusionListId: $inclusionListId, s3Key: $s3Key, fileName: $fileName) {
        id
      }
    }
  `);

  const [deleteInclusionList, { loading: deleting }] = useMutation(gql`
    mutation EeleteInclusionList($inclusionListId: ID!) {
      deleteInclusionList(inclusionListId: $inclusionListId)
    }
  `);

  const [generateUploadUrl] = useMutation(gql`
    mutation generateUploadUrl($fileName: String!, $fileType: String!) {
      generateUploadUrl(fileName: $fileName, fileType: $fileType)
    }
  `);

  const inclusionList = !loading && data ? data.inclusionList : null;

  return (
    <>
      <CCard>
        <CCardHeader>{inclusionList ? inclusionList.name : ''}</CCardHeader>
        <CCardBody>
          {loading && (
            <div style={{ textAlign: 'center', padding: '30px 0px' }}>
              <CSpinner animation="grow" color="secondary" />
            </div>
          )}
          {!loading && inclusionList && (
            <>
              <CRow>
                <CCol xl={6}>
                  <CFormGroup>
                    <CLabel htmlFor="name">Name</CLabel>
                    <CInput size="sm" type="text" id="name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
                  </CFormGroup>
                </CCol>
                <CCol xl={6}>
                  <CFormGroup>
                    <CLabel htmlFor="name">Field</CLabel>
                    <CSelect size="sm" id="name" placeholder="Name" value={field} onChange={(event) => setField(event.target.value)}>
                      <option value="md5">MD5</option>
                      <option value="sha1">SHA1</option>
                      <option value="sha256">SHA256</option>
                      <option value="email">Email</option>
                    </CSelect>
                  </CFormGroup>
                </CCol>
              </CRow>
              <CRow>
                <CCol xl={6}>
                  <CFormGroup>
                    <CLabel htmlFor="name">Last Update</CLabel>
                    <CInput size="sm" type="text" id="name" placeholder="Name" disabled value={moment(inclusionList.updatedAt).format('YYYY-MM-DD HH:mm:ss')} />
                  </CFormGroup>
                </CCol>

                <CCol xl={6}>
                  <CFormGroup>
                    <CLabel htmlFor="name">Contacts included</CLabel>
                    <CInput size="sm" type="text" id="name" placeholder="Name" disabled value={inclusionList.stats ? formatInteger(inclusionList.stats.count) : 0} />
                  </CFormGroup>
                </CCol>
              </CRow>

              <CRow>
                <CCol xl={12}>
                  <CButton
                    color="primary"
                    size="sm"
                    className="mr-3"
                    onClick={async () => {
                      await updateInclusionList({
                        variables: {
                          inclusionList: {
                            id: inclusionList.id,
                            name,
                            field
                          }
                        }
                      });
                      await refetch();
                    }}
                  >
                    {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
                    Save
                  </CButton>

                  <CButton
                    color="danger"
                    size="sm"
                    onClick={() => {
                      confirmAlert({
                        customUI: ({ onClose }) => {
                          return (
                            <CCard className="card-accent-danger">
                              <CCardHeader>Are you sure?</CCardHeader>
                              <CCardBody>
                                <p>You want to delete this inclusion list?</p>
                              </CCardBody>
                              <CCardFooter>
                                <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                                  No
                                </CButton>
                                <CButton
                                  color="danger"
                                  className="px-5"
                                  onClick={async () => {
                                    await deleteInclusionList({ variables: { inclusionListId: inclusionList.id } });
                                    onClose();
                                    history.push(`/${emailingDatabaseApiContext.getUid()}/contacts/inclusionLists/`);
                                  }}
                                >
                                  Yes, Delete it!
                                </CButton>
                              </CCardFooter>
                            </CCard>
                          );
                        }
                      });
                    }}
                  >
                    {deleting && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
                    Remove
                  </CButton>
                </CCol>
              </CRow>
            </>
          )}
        </CCardBody>
      </CCard>
      {inclusionList && inclusionList.uploadStatus && (
        <CCard>
          <CCardHeader>Import Status</CCardHeader>
          <CCardBody className="p-0">
            <table className="table table-sm table-striped">
              <tbody>
                <tr>
                  <td style={{ width: '150px' }}>
                    <div style={{ width: '150px' }}>Status</div>
                  </td>
                  <td style={{ width: '100%' }}>
                    <strong>
                      <CBadge color={getStatusBadge(inclusionList.uploadStatus.status)}>{inclusionList.uploadStatus.status}</CBadge>
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td>Contact found in the file</td>
                  <td>
                    <strong>{inclusionList.uploadStatus.total ? formatInteger(inclusionList.uploadStatus.total) : '0'}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Contact imported</td>
                  <td>
                    <strong>{inclusionList.uploadStatus.contactImported ? formatInteger(inclusionList.uploadStatus.contactImported) : '0'}</strong>
                  </td>
                </tr>
                {['waiting', 'started', 'loading_contacts'].includes(inclusionList.uploadStatus.status) && (
                  <tr>
                    <td>Progress</td>
                    <td>
                      <strong>
                        <CProgress value={calculatePercent(inclusionList.uploadStatus.contactImported, inclusionList.uploadStatus.total)} striped animated className="mb-3" />
                      </strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CCardBody>
        </CCard>
      )}

      <CCard>
        <CCardHeader>
          Contacts
          <label className="btn btn-primary btn-file btn-sm" style={{ float: 'right' }}>
            Upload CSV file
            <small style={{ width: '40px', display: 'inline-block' }}>{uploadStatus && <>({uploadStatus.progress}%)</>}</small>
            <ReactS3Uploader
              style={{ display: 'none' }}
              getSignedUrl={async (file, callback) => {
                console.log(file);
                let result = await generateUploadUrl({
                  variables: {
                    fileName: file.name,
                    fileType: file.type
                  }
                });
                setUploadStatus({
                  progress: 0
                });
                callback(result.data.generateUploadUrl);
              }}
              accept="*/*"
              onProgress={(progress) => {
                setUploadStatus({
                  ...(uploadStatus ? uploadStatus : {}),
                  progress
                });
              }}
              onError={(error) => {
                console.log('onError' + JSON.stringify(error));
                setUploadStatus(null);
              }}
              onFinish={async (finish) => {
                setUploadStatus({
                  ...(uploadStatus ? uploadStatus : {}),
                  progress: 100
                });
                console.log('onFinish:' + JSON.stringify(finish));

                await uploadInclusionListFile({
                  variables: {
                    inclusionListId: inclusionList.id,
                    s3Key: finish.s3Key,
                    fileName: finish.fileName
                  }
                });

                startRefetch(new Date().getTime() + 5 * 60 * 1000);
                setUploadStatus(null);

                toast.success(`CSV file has been uploaded. Import process started.`, {
                  position: toast.POSITION.BOTTOM_RIGHT
                });
              }}
              uploadRequestHeaders={{
                'x-amz-acl': 'public-read'
              }}
              contentDisposition="auto"
            />
          </label>
        </CCardHeader>
        <CCardBody>
          <>
            <div className="mb-0 p-2">
              <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
            </div>
            <table className="table table-sm">
              <thead>
                <tr>
                  <td>
                    <div style={{ width: '100px' }}>ID</div>
                  </td>
                  <td>Value</td>
                </tr>
              </thead>
              <tbody>
                {items &&
                  items.map((item, index) => {
                    return (
                      <tr key={index}>
                        <td>
                          <div style={{ width: '100px' }}>{item.id}</div>
                        </td>
                        <td>{item.value}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            <div className="mb-0 p-2">
              <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
            </div>
          </>
        </CCardBody>
      </CCard>
    </>
  );
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'done':
      return 'success';
    case 'started':
    case 'loading_contacts':
      return 'warning';

    case 'waiting':
    default:
      return 'secondary';
  }
};
