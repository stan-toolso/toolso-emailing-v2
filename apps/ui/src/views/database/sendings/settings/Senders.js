import { CButton, CCard, CCardBody, CCardFooter, CCardHeader, CCol, CFormGroup, CInput, CLabel, CRow, CSpinner } from '@coreui/react';
import React, { useEffect, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { confirmAlert } from 'react-confirm-alert'; // Import
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { toast } from 'react-toastify';
import MailRouterSelector from '../MailRouterSelector';

export default () => {
  const [senders, setSenders] = useState([]);
  const [created, setCreated] = useState(false);

  const { loading, data } = useQuery(gql`
    query Senders {
      senders {
        id
        mailRouter {
          id
          name
          type
        }
        name
        email
        senderName
        replyToName
        replyToEmail
        unsubscribeMailto
        trackingDomain
      }
    }
  `);

  useEffect(() => {
    if (data) {
      setSenders(JSON.parse(JSON.stringify(data.senders)));
    }
  }, [data, setSenders]);

  const [createSender, { loading: creating, data: newSender }] = useMutation(gql`
    mutation CreateMailSender {
      createSender {
        id
        mailRouter {
          id
          name
          type
        }
        name
        email
        senderName
        replyToName
        replyToEmail
        unsubscribeMailto
        trackingDomain
      }
    }
  `);

  useEffect(() => {
    if (newSender && !created) {
      let sender = JSON.parse(JSON.stringify(newSender.createSender));
      sender.edit = true;
      setCreated(true);
      setSenders([...senders, sender]);
    }
  }, [newSender, created, setCreated, senders, setSenders]);

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
              createSender();
            }}
          >
            {creating && <CSpinner color="secondary" />}
            Add new sender
          </CButton>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '10px 0px' }}>
            <CSpinner animation="grow" color="secondary" />
          </div>
        )}

        {!loading && senders.length === 0 && <div className="text-center text-muted p-5 ">You don&apos;t have any sender configured.</div>}

        {!loading && senders.length > 0 && (
          <table className="table table-sm table-responsive-sm table-bordered">
            <thead>
              <tr>
                <th>ID</th>
                <th>Router</th>
                <th>Router type</th>
                <th style={{ width: '100%' }}>Name</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            {senders.map((sender, index) => {
              return (
                <tbody key={index}>
                  <tr
                    onClick={() => {
                      sender.edit = !sender.edit;
                      setSenders([...senders]);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ width: '60px' }}> {sender.id}</div>
                    </td>
                    <td>
                      <div style={{ width: '150px' }}> {sender.mailRouter ? sender.mailRouter.name : ''}</div>
                    </td>
                    <td>
                      <div style={{ width: '100px' }}> {sender.mailRouter ? sender.mailRouter.type : ''}</div>
                    </td>
                    <td>
                      <div className="w-100">{sender.name}</div>
                    </td>
                    <td>
                      <div style={{ width: '250px' }}> {sender.email}</div>
                    </td>
                    <td>
                      <div className="px-2" style={{ width: '35px' }}>
                        <i className={`fas fa-chevron-${sender.edit ? 'up' : 'down'}`}></i>
                      </div>
                    </td>
                  </tr>
                  <tr style={{ display: sender.edit ? null : 'none' }}>
                    <td colSpan={6} className="bg-light text-dark">
                      <SenderEditor
                        sender={sender}
                        setSender={(newSender) => {
                          if (newSender === null) {
                            senders.splice(senders.indexOf(sender), 1);
                          } else {
                            senders[senders.indexOf(sender)] = newSender;
                          }
                          setSenders([...senders]);
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

const SenderEditor = ({ sender, setSender }) => {
  const [name, setName] = useState(sender.name);
  const [mailRouterId, setMailRouterId] = useState(sender.mailRouter ? sender.mailRouter.id : null);

  const [email, setEmail] = useState(sender.email);
  const [senderName, setSenderName] = useState(sender.senderName);

  const [replyToEmail, setReplyToEmail] = useState(sender.replyToEmail);
  const [replyToName, setReplyToName] = useState(sender.replyToName);

  const [unsubscribeMailto, setUnsubscribeMailto] = useState(sender.unsubscribeMailto);

  const [trackingDomain, setTrackingDomain] = useState(sender.trackingDomain ? sender.trackingDomain : '');

  const [updated, setUpdated] = useState(true);

  const [updateSender, { loading: updating, data: dataUpdated }] = useMutation(gql`
    mutation UpdateSender($sender: JSON!) {
      updateSender(sender: $sender) {
        id
        mailRouter {
          id
          name
          type
        }
        name
        email

        senderName
        replyToName
        replyToEmail
        unsubscribeMailto
        trackingDomain
      }
    }
  `);
  useEffect(() => {
    if (dataUpdated && !updated) {
      setSender({
        ...dataUpdated.updateSender,
        edit: true
      });
      setUpdated(true);
    }
  }, [dataUpdated, updated, setSender]);

  const [deleteSender] = useMutation(gql`
    mutation DeleteMailSender($senderId: ID!) {
      deleteSender(senderId: $senderId)
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
            <CLabel htmlFor="senderName">Mail Router</CLabel>
            <MailRouterSelector
              mailRouterId={mailRouterId}
              setMailRouter={(mailRouter) => {
                setMailRouterId(mailRouter ? mailRouter.id : null);
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="senderName">Sender Name</CLabel>
            <CInput
              size="sm"
              type="text"
              id="senderName"
              placeholder="Sender Name"
              value={senderName}
              onChange={(event) => {
                setSenderName(event.target.value);
              }}
            />
          </CFormGroup>
        </CCol>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="email">Email</CLabel>
            <CInput
              size="sm"
              type="text"
              id="email"
              placeholder="Email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="replyToName">ReplyTo Name</CLabel>
            <CInput
              size="sm"
              type="text"
              id="replyToName"
              placeholder="ReplyTo Name"
              value={replyToName}
              onChange={(event) => {
                setReplyToName(event.target.value);
              }}
            />
          </CFormGroup>
        </CCol>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="replyToEmail">ReplyTo Email</CLabel>
            <CInput
              size="sm"
              type="text"
              id="replyToEmail"
              placeholder="ReplyTo Email"
              value={replyToEmail}
              onChange={(event) => {
                setReplyToEmail(event.target.value);
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>
      <CRow>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="unsubscribeMailto">Unsubscribe Mailto</CLabel>
            <CInput
              size="sm"
              type="text"
              id="unsubscribeMailto"
              placeholder="Unsubscribe Mailto"
              value={unsubscribeMailto}
              onChange={(event) => {
                setUnsubscribeMailto(event.target.value);
              }}
            />
          </CFormGroup>
        </CCol>
        <CCol sm="6">
          <CFormGroup>
            <CLabel htmlFor="trackingDomain">Tracking Domain</CLabel>
            <CInput
              size="sm"
              type="text"
              id="trackingDomain"
              placeholder="Tracking Domain"
              value={trackingDomain}
              onChange={(event) => {
                setTrackingDomain(event.target.value);
              }}
            />
          </CFormGroup>
        </CCol>
      </CRow>

      <CRow className="mt-2">
        <CCol xl={12}>
          <CButton
            color="primary"
            className="mr-3"
            size="sm"
            onClick={() => {
              setUpdated(false);
              updateSender({
                variables: {
                  sender: {
                    id: sender.id,
                    name,
                    email,

                    senderName,
                    replyToName,
                    replyToEmail,
                    unsubscribeMailto,
                    trackingDomain,
                    mailRouterId: mailRouterId ? parseInt(mailRouterId) : null
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
                        <p>You want to delete this mail sender configuration? </p>
                      </CCardBody>
                      <CCardFooter>
                        <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                          No
                        </CButton>
                        <CButton
                          color="danger"
                          className="px-5"
                          onClick={async () => {
                            let response = await deleteSender({ variables: { senderId: sender.id } });
                            if (response && response.data && response.data.deleteMailSender === 'ok') {
                              setSender(null);
                              toast.success(`Mail sender ${sender.name} has been deleted`, {
                                position: toast.POSITION.BOTTOM_RIGHT
                              });
                            } else {
                              toast.error(`Failed to delete sender ${sender.name}.`, {
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
