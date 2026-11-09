import { CButton, CCard, CCardBody, CCardFooter, CCardHeader, CCol, CFormGroup, CInput, CLabel, CRow, CSelect, CSpinner } from '@coreui/react';
import React, { useEffect, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { confirmAlert } from 'react-confirm-alert'; // Import
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { toast } from 'react-toastify';

export default () => {
  const [routers, setRouters] = useState([]);
  const [created, setCreated] = useState(false);

  const { loading, data } = useQuery(gql`
    query MailRouters {
      mailRouters {
        id
        name
        type
        config
      }
    }
  `);

  useEffect(() => {
    if (data) {
      setRouters(JSON.parse(JSON.stringify(data.mailRouters)));
    }
  }, [data, setRouters]);

  const [createMailRouter, { loading: creating, data: newMailRouter }] = useMutation(gql`
    mutation CreateMailRouter {
      createMailRouter {
        id
        name
        type
        config
      }
    }
  `);

  useEffect(() => {
    if (newMailRouter && !created) {
      let mailRouter = JSON.parse(JSON.stringify(newMailRouter.createMailRouter));
      mailRouter.edit = true;
      setCreated(true);
      setRouters([...routers, mailRouter]);
    }
  }, [newMailRouter, created, setCreated, routers, setRouters]);

  return (
    <CRow>
      <CCol>
        <div className="d-flex justify-content-end mb-2">
          <CButton
            color="primary"
            size="sm"
            disabled={creating}
            onClick={() => {
              setCreated(false);
              createMailRouter();
            }}
          >
            {creating && <CSpinner color="secondary" />}
            Configure a new mail router
          </CButton>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '10px 0px' }}>
            <CSpinner animation="grow" color="secondary" />
          </div>
        )}

        {!loading && routers.length === 0 && <div className="text-center text-muted p-5 ">You don&apos;t have any mail router configured.</div>}

        {!loading && routers.length > 0 && (
          <table className="table table-sm table-responsive-sm table-bordered">
            <thead>
              <tr>
                <th>ID</th>
                <th style={{ width: '100%' }}>Name</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            {routers.map((router, index) => {
              return (
                <tbody key={index}>
                  <tr
                    onClick={() => {
                      router.edit = !router.edit;
                      setRouters([...routers]);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ width: '60px' }}> {router.id}</div>
                    </td>
                    <td>
                      <div className="w-100">{router.name}</div>
                    </td>
                    <td>
                      <div style={{ width: '150px' }}> {router.type}</div>
                    </td>
                    <td>
                      <div className="px-2" style={{ width: '35px' }}>
                        <i className={`fas fa-chevron-${router.edit ? 'up' : 'down'}`}></i>
                      </div>
                    </td>
                  </tr>
                  <tr style={{ display: router.edit ? null : 'none' }}>
                    <td colSpan={4} className="bg-light text-dark">
                      <RouterEditor
                        router={router}
                        setRouter={(newRouter) => {
                          if (newRouter === null) {
                            routers.splice(routers.indexOf(router), 1);
                          } else {
                            routers[routers.indexOf(router)] = newRouter;
                          }
                          setRouters([...routers]);
                        }}
                      />
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        )}
      </CCol>
    </CRow>
  );
};

const RouterEditor = ({ router, setRouter }) => {
  const [name, setName] = useState(router.name);
  const [type, setType] = useState(router.type ? router.type : '');
  const [updated, setUpdated] = useState(true);
  const [credentials, setCredentials] = useState(null);
  const [config, setConfig] = useState(router.config ? router.config : {});

  const [updateMailRouter, { loading: updating, data: dataUpdated }] = useMutation(gql`
    mutation UpdateMailRouter($mailRouter: JSON!) {
      updateMailRouter(mailRouter: $mailRouter) {
        id
        name
        type
        config
      }
    }
  `);
  useEffect(() => {
    if (dataUpdated && !updated) {
      setRouter({
        ...dataUpdated.updateMailRouter,
        edit: true
      });
      setUpdated(true);
    }
  }, [dataUpdated, updated, setRouter]);

  const [deleteMailRouter] = useMutation(gql`
    mutation DeleteMailRouter($mailRouterId: ID!) {
      deleteMailRouter(mailRouterId: $mailRouterId)
    }
  `);

  return (
    <div className="p-2">
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="name">Name</CLabel>
            <CInput size="sm" type="text" id="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} />
          </CFormGroup>
        </CCol>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="name">Type</CLabel>
            <CSelect size="sm" type="text" id="name" placeholder="Name" required value={type} onChange={(event) => setType(event.target.value)}>
              <option value=""> -- Select your router --</option>
              <option value="aws_ses">AWS Simple Email Service</option>
              <option value="sib">Sendinblue</option>
              <option value="toolso">Toolso</option>
            </CSelect>
          </CFormGroup>
        </CCol>
      </CRow>
      {type === 'aws_ses' && <AWSSESEditor config={config} setConfig={setConfig} setCredentials={setCredentials} credentials={credentials} />}

      {type === 'sib' && <SIBEditor config={config} setConfig={setConfig} setCredentials={setCredentials} credentials={credentials} />}

      <CRow className="mt-2">
        <CCol xl={12}>
          <CButton
            color="primary"
            className="mr-3"
            size="sm"
            onClick={() => {
              setUpdated(false);
              updateMailRouter({
                variables: {
                  mailRouter: {
                    id: router.id,
                    name,
                    type,
                    config,
                    credentials: credentials && Object.keys(credentials).length ? credentials : null
                  }
                }
              });
            }}
          >
            {updating && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
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
                        <p>You want to delete this mail router configuration? </p>
                      </CCardBody>
                      <CCardFooter>
                        <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                          No
                        </CButton>
                        <CButton
                          color="danger"
                          className="px-5"
                          onClick={async () => {
                            let response = await deleteMailRouter({ variables: { mailRouterId: router.id } });
                            if (response && response.data && response.data.deleteMailRouter === 'ok') {
                              setRouter(null);
                              toast.success(`Mail router ${router.name} has been deleted`, {
                                position: toast.POSITION.BOTTOM_RIGHT
                              });
                            } else {
                              toast.error(`Failed to delete router ${router.name}.`, {
                                position: toast.POSITION.BOTTOM_RIGHT
                              });
                            }
                            onClose();
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
            Delete
          </CButton>
        </CCol>
      </CRow>
    </div>
  );
};

const AWSSESEditor = ({ config, setConfig, credentials, setCredentials }) => {
  let accessKeyId = credentials ? credentials.accessKeyId : config.accessKeyId ? config.accessKeyId : '';
  let secretAccessKey = credentials ? credentials.secretAccessKey : config.secretAccessKey ? config.secretAccessKey : '';

  return (
    <>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="accessKeyId">Access Key ID</CLabel>
            <CInput
              size="sm"
              type="text"
              id="accessKeyId"
              placeholder="Access Key ID"
              value={accessKeyId ? accessKeyId : ''}
              onChange={(event) => {
                if (!credentials) {
                  credentials = {};
                }
                credentials.accessKeyId = event.target.value;
                config.accessKeyId = event.target.value;
                setCredentials({ ...credentials });
                setConfig({ ...config });
              }}
            />
          </CFormGroup>
        </CCol>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="secretAccessKey">Access Secret Key</CLabel>
            <CInput
              size="sm"
              type="text"
              id="secretAccessKey"
              placeholder="Access Secret Key"
              value={secretAccessKey ? secretAccessKey : ''}
              onChange={(event) => {
                if (!credentials) {
                  credentials = {};
                }
                credentials.accessKeyId = accessKeyId;
                credentials.secretAccessKey = event.target.value;
                config.secretAccessKey = '*********************************' + credentials.secretAccessKey.substring(Math.max(10, credentials.secretAccessKey.length - 4));

                setCredentials({ ...credentials });
                setConfig({ ...config });
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="name">Region</CLabel>
            <CInput
              size="sm"
              type="text"
              id="region"
              placeholder="Region"
              value={config.region ? config.region : ''}
              onChange={(event) => {
                config.region = event.target.value;
                setConfig({ ...config });
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel>Configuration Sets used</CLabel>
            <div className="d-flex justify-content-start mb-2">
              <CButton
                color="secondary"
                size="sm"
                onClick={() => {
                  if (!config.configurationSets) {
                    config.configurationSets = [];
                  }
                  config.configurationSets.push({
                    name: '',
                    weight: config.configurationSets.length > 0 ? 0 : 100
                  });
                  setConfig({ ...config });
                }}
              >
                Add Configuration Set
              </CButton>
            </div>
            {(!config.configurationSets || config.configurationSets.length === 0) && <div className="text-center text-muted py-1 ">You don&apos;t have any configuration sets configured.</div>}
            {config.configurationSets && config.configurationSets.length > 0 && (
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: '100%' }}>Name</th>
                    <th style={{ width: '60px' }}>Weight (%)</th>
                    <th style={{ width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {config.configurationSets &&
                    config.configurationSets.map((item, index) => {
                      return (
                        <tr key={index}>
                          <td>
                            <CInput
                              className="w-100"
                              type="text"
                              value={item.name}
                              size="sm"
                              onChange={(event) => {
                                item.name = event.target.value;
                                setConfig({ ...config });
                              }}
                            />
                          </td>
                          <td>
                            <CInput
                              style={{ width: '60px' }}
                              type="number"
                              value={item.weight}
                              size="sm"
                              min={0}
                              max={100}
                              onChange={(event) => {
                                let newValue = parseInt(event.target.value);
                                if (!isNaN(newValue)) {
                                  item.weight = newValue;
                                  updateIpWeights(config.configurationSets, item);
                                } else {
                                  item.weight = '';
                                }
                                setConfig({ ...config });
                              }}
                            />
                          </td>
                          <td>
                            <div className="pt-1" style={{ width: '30px' }}>
                              <i
                                className="fa fa-sm fa-trash"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  config.configurationSets.splice(index, 1);
                                  setConfig({ ...config });
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </CFormGroup>
        </CCol>
      </CRow>
    </>
  );
};

const SIBEditor = ({ config, setConfig, credentials, setCredentials }) => {
  let apiKeyV3 = credentials ? credentials.apiKeyV3 : config.apiKeyV3 ? config.apiKeyV3 : '';

  return (
    <>
      <CRow>
        <CCol sm="12">
          <CFormGroup>
            <CLabel htmlFor="apiKeyV3">ApiKey V3</CLabel>
            <CInput
              size="sm"
              type="text"
              id="secretAccessKey"
              placeholder="ApiKey V3"
              value={apiKeyV3 ? apiKeyV3 : ''}
              onChange={(event) => {
                if (!credentials) {
                  credentials = {};
                }
                credentials.apiKeyV3 = event.target.value;
                config.apiKeyV3 = credentials.apiKeyV3.substring(0, Math.min(12, credentials.apiKeyV3.length - 4)) + '*********************************';

                setCredentials({ ...credentials });
                setConfig({ ...config });
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel>IPs used</CLabel>
            <div className="d-flex justify-content-start mb-2">
              <CButton
                color="secondary"
                size="sm"
                onClick={() => {
                  if (!config.ips) {
                    config.ips = [];
                  }
                  config.ips.push({
                    ip: '',
                    weight: config.ips.length > 0 ? 0 : 100
                  });
                  setConfig({ ...config });
                }}
              >
                Add IP
              </CButton>
            </div>
            {(!config.ips || config.ips.length === 0) && <div className="text-center text-muted py-1 ">You don&apos;t have any IP configured.</div>}
            {config.ips && config.ips.length > 0 && (
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: '100%' }}>IP</th>
                    <th style={{ width: '60px' }}>Weight (%)</th>
                    <th style={{ width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {config.ips &&
                    config.ips.map((item, index) => {
                      return (
                        <tr key={index}>
                          <td>
                            <CInput
                              className="w-100"
                              type="text"
                              value={item.ip}
                              size="sm"
                              onChange={(event) => {
                                item.ip = event.target.value;
                                setConfig({ ...config });
                              }}
                            />
                          </td>
                          <td>
                            <CInput
                              style={{ width: '60px' }}
                              type="number"
                              value={item.weight}
                              size="sm"
                              min={0}
                              max={100}
                              onChange={(event) => {
                                let newValue = parseInt(event.target.value);
                                if (!isNaN(newValue)) {
                                  item.weight = newValue;
                                  updateIpWeights(config.ips, item);
                                } else {
                                  item.weight = '';
                                }
                                setConfig({ ...config });
                              }}
                            />
                          </td>
                          <td>
                            <div className="pt-1" style={{ width: '30px' }}>
                              <i
                                className="fa fa-sm fa-trash"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  config.ips.splice(index, 1);
                                  setConfig({ ...config });
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </CFormGroup>
        </CCol>
      </CRow>
    </>
  );
};

const updateIpWeights = (ips, ip) => {
  let availableWeight = 100 - (isNaN(ip.weight) ? 0 : ip.weight);
  let lastIp = 0;
  ips.forEach((item) => {
    if (item === ip) {
      return;
    }
    lastIp = item;
    availableWeight -= item.weight && !isNaN(item.weight) ? item.weight : 0;
    if (availableWeight < 0) {
      item.weight += availableWeight;
      availableWeight = 0;
    }
  });
  if (availableWeight >= 0) {
    if (lastIp) {
      lastIp.weight = (lastIp.weight && !isNaN(lastIp.weight) ? lastIp.weight : 0) + availableWeight;
    } else {
      ip.weight += availableWeight;
    }
  }
};
