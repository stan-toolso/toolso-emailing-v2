import { useMutation } from '@apollo/client';
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormGroup, CInput, CLabel, CRow, CSpinner, CTextarea, CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import moment from 'moment';
import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import SendingConfigSelector from '../../sendings/SendingConfigSelector';
import { getBatStatusBadge } from '../bats/util';
import ContentSendTestModal from './ContentSendTestModal';
import PartnersSelector from '../partners/PartnersSelector';
import { toast } from 'react-toastify';
import Mustache from 'mustache';

export default ({ content, forceUpdate }) => {
  if (!content.bats) {
    content.bats = [];
  }

  const [createBat, { loading }] = useMutation(gql`
    mutation createBat($contentId: ID!) {
      createBat(contentId: $contentId) {
        id
        date
        status
        author
        partner {
          id
          contacts
        }
      }
    }
  `);

  return (
    <>
      <div className="mb-2">
        <CButton
          color="primary"
          size="sm"
          onClick={async () => {
            let result = await createBat({
              variables: {
                contentId: content.id
              }
            });
            if (result && result.data && result.data.createBat) {
              content.bats.push(result.data.createBat);
              forceUpdate();
            }
          }}
        >
          {loading && <CSpinner color="secondary" />}
          Create new BAT
        </CButton>
      </div>

      {content.bats.map((bat, index) => {
        return <ContentBat key={index} bat={bat} content={content} forceUpdate={forceUpdate} />;
      })}
    </>
  );
};

const ContentBat = ({ content, bat, forceUpdate }) => {
  let firstContact = content?.partner?.contacts?.list[0];
  const [validatorsEmails, setValidatorsEmails] = useState(bat.validatorsEmails ?? firstContact?.validatorsEmails ?? '');
  const [message, setMessage] = useState(bat.message ?? firstContact?.defaultMessage);
  const [partner, setPartner] = useState(bat.partner ?? content.partner ?? '');
  const [selectedContact, setSelectedContact] = useState(0);

  const [sendingConfigId, setSendingConfigId] = useState(bat.sendingConfig ? bat.sendingConfig.id : '');

  const [updateBat, { loading: saving }] = useMutation(gql`
    mutation updateBat($bat: JSON!) {
      updateBat(bat: $bat) {
        id
        date
        status
        author
        message
        validations
        validatorsEmails
        partner {
          id
          name
          contacts
        }
        sendingConfig {
          id
          name
        }
      }
    }
  `);

  const [sendBat, { loading: sending }] = useMutation(gql`
    mutation sendBat($batId: ID!) {
      sendBat(batId: $batId) {
        id
        status
      }
    }
  `);

  const saveDraft = useCallback(async () => {
    await updateBat({
      variables: {
        bat: {
          id: bat.id,
          message,
          validatorsEmails,
          sendingConfigId,
          partnerId: partner.id
        }
      }
    });
    toast.success('The BAT has been updated', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
  }, [bat, updateBat, message, validatorsEmails, sendingConfigId, partner]);

  const saveAndSend = useCallback(async () => {
    await updateBat({
      variables: {
        bat: {
          id: bat.id,
          message,
          validatorsEmails,
          sendingConfigId,
          partnerId: partner.id
        }
      }
    });

    toast.success('The BAT has been updated', {
      position: toast.POSITION.BOTTOM_RIGHT
    });
    let sendResult = await sendBat({
      variables: {
        batId: bat.id
      }
    });
    if (sendResult && sendResult.data && sendResult.data.sendBat) {
      bat.status = sendResult.data.sendBat.status;
      forceUpdate();

      toast.success('The BAT has been sent', {
        position: toast.POSITION.BOTTOM_RIGHT
      });
    }
  }, [bat, updateBat, sendBat, forceUpdate, message, validatorsEmails, sendingConfigId, partner]);

  return (
    <CCard color="secondary">
      <CCardHeader
        onClick={() => {
          bat.opened = !bat.opened;
          forceUpdate();
        }}
        style={{ cursor: 'pointer' }}
      >
        <CBadge color={getBatStatusBadge(bat.status)}>{bat.status}</CBadge> - #{bat.id} - {bat.date ? moment(bat.date).format('YYYY/MM/DD HH:mm:ss') : ''}
        <div className="px-2" style={{ width: '35px', float: 'right' }}>
          <i className={`fas fa-chevron-${bat.opened ? 'up' : 'down'}`}></i>
        </div>
      </CCardHeader>
      {bat.opened && (
        <CCardBody className="pt-1">
          <CRow>
            <CCol sm="4">
              <CFormGroup>
                <CLabel>Sending Config</CLabel>
                <SendingConfigSelector sendingConfigId={sendingConfigId} setSendingConfigId={setSendingConfigId} />
              </CFormGroup>
            </CCol>
            <CCol sm="4">
              {' '}
              <CFormGroup>
                <CLabel>Partner</CLabel>
                <PartnersSelector
                  partnerId={partner.id}
                  setPartner={(partner) => {
                    setPartner(partner);
                    if (partner && bat.status === 'draft') {
                      setValidatorsEmails(partner?.contacts?.list[0]?.validatorsEmails ?? partner.validatorsEmails);
                      let defaultMessage = partner?.contacts?.list[0]?.defaultMessage ?? partner.defaultMessage;
                      let message = Mustache.render(defaultMessage, {
                        content,
                        bat
                      });

                      setMessage(message);
                    }
                  }}
                />
              </CFormGroup>
            </CCol>
            {partner?.contacts?.list?.length > 0 && (
              <CCol sm="4">
                <CFormGroup>
                  <CLabel>Contact</CLabel>
                  <CSelect
                    size="sm"
                    id="contactSelector"
                    value={selectedContact}
                    onChange={(event) => {
                      setValidatorsEmails(partner?.contacts?.list[event.target.value]?.validatorsEmails);
                      let defaultMessage = partner?.contacts?.list[event.target.value]?.defaultMessage ?? partner.defaultMessage;
                      let newMessage = Mustache.render(defaultMessage, {
                        content,
                        bat
                      });
                      setMessage(newMessage);
                      setSelectedContact(event.target.value);
                    }}
                  >
                    {partner?.contacts?.list?.map((contact, index) => {
                      return (
                        <option key={index} value={index}>
                          {contact.validatorsEmails}
                        </option>
                      );
                    })}
                  </CSelect>
                </CFormGroup>
              </CCol>
            )}
          </CRow>
          <CRow>
            <CCol sm="12">
              <CFormGroup>
                <CLabel htmlFor="validatorsEmails">Recipient emails (comma separated)</CLabel>
                <CInput
                  size="sm"
                  type="email"
                  id="validatorsEmails"
                  placeholder="Recipient email"
                  required
                  disabled={bat.status !== 'draft' && bat.status !== 'waiting'}
                  value={validatorsEmails}
                  onChange={(event) => setValidatorsEmails(event.target.value)}
                  data-form-type="other"
                  data-lpignore="true"
                />
              </CFormGroup>
            </CCol>

            <CCol sm="12">
              <CFormGroup>
                <CLabel htmlFor="message">Message</CLabel>
                <CTextarea
                  disabled={bat.status !== 'draft'}
                  size="sm"
                  id="message"
                  placeholder="Message"
                  required
                  style={{ height: '100px' }}
                  value={message ?? ''}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </CFormGroup>
            </CCol>
          </CRow>
          {bat.comments && bat.comments.length > 0 && (
            <CRow>
              <CCol sm="12">
                <CLabel htmlFor="message">Comments</CLabel>

                {bat.comments.map((comment, index) => {
                  return (
                    <CRow key={index}>
                      <CCol sm="1"></CCol>
                      <CCol sm="11">
                        <CCard>
                          <CCardBody className="p-1">
                            <small className="text-muted">
                              {moment(comment.date).format('YYYY/MM/DD HH:mm:ss')} - From <span style={{ fontWeight: 'bold' }}>{comment.author}</span>
                            </small>
                            <br />
                            {comment.message}
                          </CCardBody>
                        </CCard>
                      </CCol>
                    </CRow>
                  );
                })}
              </CCol>
            </CRow>
          )}

          {['draft', 'waiting'].indexOf(bat.status) >= 0 && (
            <CButton color="primary" className="mr-3" size="sm" onClick={saveDraft}>
              {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="primary" />}
              Save
            </CButton>
          )}

          {validatorsEmails && ['draft', 'waiting'].indexOf(bat.status) >= 0 && (
            <CButton color="success" className="mr-3" size="sm" onClick={saveAndSend}>
              {(saving || sending) && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="success" />}
              Save and send
            </CButton>
          )}

          {bat.validations && (
            <table className="table table-sm mt-2">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Object.values(bat.validations).map((validation, index) => {
                  return <BatValidation content={content} bat={bat} key={index} validation={validation} forceUpdate={forceUpdate} />;
                })}
              </tbody>
            </table>
          )}
        </CCardBody>
      )}
    </CCard>
  );
};

const BatValidation = ({ content, bat, validation, forceUpdate }) => {
  const user = useSelector((state) => state.user);

  const [showSendTestModal, setShowSendTestModal] = useState(false);

  const [sendBat, { loading: sendingBat }] = useMutation(gql`
    mutation sendBat($batId: ID!, $versionId: ID) {
      sendBat(batId: $batId, versionId: $versionId) {
        id
        status
      }
    }
  `);

  let versions = content.versions.filter((version) => {
    return parseInt(version.id) === validation.versionId;
  });
  let version = versions && versions.length === 1 ? versions[0] : null;

  if (validation.status === 'waiting' && (!version || version.disabled)) {
    return null;
  }

  return (
    <>
      <tr
        onClick={() => {
          validation.opened = !validation.opened;
          forceUpdate();
        }}
        style={{ cursor: 'pointer' }}
      >
        <td>
          #{validation.versionId} - {validation.versionName}
        </td>
        <td>
          <CBadge color={getBatStatusBadge(validation.status)}>{validation.status}</CBadge>
        </td>
        <td>
          <div className="px-2" style={{ width: '35px', float: 'right' }}>
            <i className={`fas fa-chevron-${validation.opened ? 'up' : 'down'}`}></i>
          </div>
        </td>
      </tr>
      {validation.opened && (
        <tr>
          <td colSpan={3}>
            <table className="table table-sm table-striped table-dark">
              <tr>
                <td>
                  <div style={{ width: '200px' }}>Last sender date</div>
                </td>
                <td style={{ fontWeight: 'bold', width: '100%' }}>{moment(validation.lastSendbatDate).format('YYYY/MM/DD HH:mm:ss')}</td>
              </tr>
              {validation.comment && (
                <tr>
                  <td>
                    <div style={{ width: '200px' }}>Comment</div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    <small className="text-muted">
                      {moment(validation.comment.date).format('YYYY/MM/DD HH:mm:ss')} - From <span style={{ fontWeight: 'bold' }}>{validation.comment.author}</span>
                    </small>
                    <br />
                    {validation.comment.message}
                  </td>
                </tr>
              )}
              {validation.ip && (
                <tr>
                  <td>
                    <div style={{ width: '200px' }}>IP</div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{validation.ip}</td>
                </tr>
              )}
              {validation.userAgent && (
                <tr>
                  <td>
                    <div style={{ width: '200px' }}>UserAgent</div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{validation.userAgent}</td>
                </tr>
              )}
              {validation.validator && (
                <tr>
                  <td>
                    <div style={{ width: '200px' }}>Validator email</div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{validation.validator}</td>
                </tr>
              )}

              <tr>
                <td>
                  <div style={{ width: '200px' }}>Actions</div>
                </td>
                <td style={{ fontWeight: 'bold' }}>
                  {bat.status === 'waiting' && validation.status === 'waiting' && (
                    <CButton
                      color="success"
                      className="mr-3"
                      size="sm"
                      onClick={async () => {
                        let sendResult = await sendBat({
                          variables: {
                            batId: bat.id,
                            versionId: version.id
                          }
                        });
                        if (sendResult && sendResult.data && sendResult.data.sendBat) {
                          bat.status = sendResult.data.sendBat.status;
                          forceUpdate();
                        }
                      }}
                    >
                      {sendingBat && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="success" />}
                      Send this BAT
                    </CButton>
                  )}
                  <CButton
                    className="mr-2"
                    size="sm"
                    color="success"
                    onClick={() => {
                      setShowSendTestModal(true);
                    }}
                  >
                    Send Test
                  </CButton>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      )}
      <tr>
        <td>
          <ContentSendTestModal
            defaultEmails={[
              user.email,
              ...(bat.validatorsEmails ? bat.validatorsEmails.split(',') : []).filter((a) => {
                return a !== user.email;
              })
            ]}
            content={content}
            contentVersion={version}
            show={showSendTestModal}
            toggle={() => {
              setShowSendTestModal(false);
            }}
          />
        </td>
      </tr>
    </>
  );
};
