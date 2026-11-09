import React, { useContext, useState } from 'react';
import { useSelector } from 'react-redux';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { CButton, CCard, CCardBody, CCardFooter, CCardHeader, CDataTable, CLink, CSpinner, CBadge, CTooltip } from '@coreui/react';
import Switch from 'react-switch';

import { updateContent, canActivateContent, canDeleteContent, deleteContent } from '../util';
import moment from 'moment-timezone';
import { calculateAndFormatPercent, formatFloat, formatInteger } from '../../../util';
import SuspendContentModal from './SuspendContentModal';

import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

export default ({ contents, loading, forceUpdate, cloneContent, showPartner, showEcpm, refetch, showRefComplaints }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const userEntreprise = useSelector((state) => state.userEntreprise);
  const [showModalSuspendContent, setShowModalSuspend] = useState(false);
  const isSuperAdmin = userEntreprise.role === 'superAdmin';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0px' }}>
        <CSpinner animation="grow" color="secondary" />
      </div>
    );
  }
  return (
    <>
      <SuspendContentModal
        show={showModalSuspendContent ? true : false}
        contentToSuspend={showModalSuspendContent}
        toggle={() => {
          refetch && refetch();
          setShowModalSuspend(false);
        }}
      />
      <CDataTable
        items={loading ? null : contents}
        fields={[
          { key: 'isActive' },
          { key: 'id' },
          ...(showPartner ? [{ key: 'partner' }] : []),
          { key: 'name', _classes: 'font-weight-bold' },
          { key: 'type' },
          { key: 'startDate' },
          { key: 'endDate' },
          { key: 'request' },
          { key: 'open' },
          { key: 'click' },
          { key: 'unsub' },
          ...(showRefComplaints ? [{ key: 'refUnsubRate' }] : []),
          { key: 'complaint' },
          ...(showRefComplaints ? [{ key: 'refComplaintRate' }] : []),
          ...(showEcpm ? [{ key: 'eCpm' }] : []),
          { key: 'priority' },
          { key: 'weight' },
          { key: 'maxSchedule' },
          { key: 'actions' },
          { key: 'createdAt' }
        ]}
        columnHeaderSlot={{
          isActive: <div style={{ width: '50px' }}>Active</div>,
          id: <div style={{ width: '50px' }}>#ID</div>,
          patner: <div style={{ width: '150px' }}>Partner</div>,
          name: <div style={{ width: '100%', minWidth: '300px' }}>Name</div>,
          type: <div style={{ width: '50px' }}>Type</div>,
          startDate: <div style={{ width: '100px' }}>Start date</div>,
          endDate: <div style={{ width: '100px' }}>End date</div>,
          priority: <div style={{ width: '60px' }}>Prio</div>,
          weight: <div style={{ width: '60px' }}>Weig.</div>,
          maxSchedule: <div style={{ width: '60px' }}>Max Sch.</div>,
          request: <div style={{ width: '70px' }}>Request</div>,
          open: <div style={{ width: '90px' }}>Open</div>,
          click: <div style={{ width: '90px' }}>Click</div>,
          unsub: <div style={{ width: '90px' }}>Unsub</div>,
          complaint: <div style={{ width: '90px' }}>Complaint</div>,
          eCpm: <div style={{ width: '90px' }}>eCPM</div>,
          actions: <div style={{ width: isSuperAdmin ? '80px' : '60px' }}></div>,
          createdAt: <div style={{ width: '100px' }}>Creation date</div>,
          refUnsubRate: (
            <CTooltip content={`the "Reference Unsub Rate" is the ratio of unsubscription versus the unique opens for non recent contacts`}>
              <div style={{ width: '100px' }}>Ref Unsub %</div>
            </CTooltip>
          ),
          refComplaintRate: (
            <CTooltip content={`the "Reference Complaint Rate" is the ratio of received complaints versus the unique opens for non recent contacts`}>
              <div style={{ width: '120px' }}>Ref Complaint %</div>
            </CTooltip>
          )
        }}
        size="sm"
        hover
        striped
        loading={loading}
        scopedSlots={{
          isActive: (content) => (
            <td
              style={{ width: '50px' }}
              onClick={(event) => {
                event.stopPropagation();
                event.nativeEvent.stopPropagation();
              }}
            >
              <Switch
                onChange={(checked) => {
                  updateContent(emailingDatabaseApiContext, content, { isActive: checked }, checked ? 'Content is enabled' : 'Content is disabled', forceUpdate);
                }}
                checked={content.isActive}
                disabled={!canActivateContent(content)}
                uncheckedIcon={false}
                checkedIcon={false}
                height={18}
                width={35}
              />
            </td>
          ),
          name: (content) => (
            <td style={{ width: '100%' }}>
              <div style={{ height: '24px', overflow: 'hidden', lineHeight: '24px' }}>
                {content.suspended && (
                  <CTooltip content={`suspended by Toolso (${content.suspensionReason})`}>
                    <CBadge color="danger" style={{ verticalAlign: 'top', marginTop: '4px', marginRight: '2px' }}>
                      suspended
                    </CBadge>
                  </CTooltip>
                )}

                <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/list/${content.id}`}> {content.name}</CLink>
              </div>
            </td>
          ),

          partner: (content) => {
            if (content.partner) {
              return (
                <td style={{ width: '100px' }}>
                  <div style={{ height: '24px', overflow: 'hidden', lineHeight: '24px' }}>
                    <CLink to={`/${emailingDatabaseApiContext.getUid()}/contents/partners/${content.partner.id}`}> {content.partner.name}</CLink>
                  </div>
                </td>
              );
            } else {
              return <td style={{ width: '100px' }}></td>;
            }
          },
          startDate: (content) => <td style={{ width: '100px' }}>{content.startDate ? moment(content.startDate).format('YYYY/MM/DD') : ''}</td>,
          endDate: (content) => <td style={{ width: '100px' }}>{content.endDate ? moment(content.endDate).format('YYYY/MM/DD') : ''}</td>,
          priority: (content) => <td style={{ width: '60px' }}>{content.config && 'priority' in content.config ? content.config.priority : 1}</td>,
          weight: (content) => <td style={{ width: '60px' }}>{content.config && 'weight' in content.config ? content.config.weight : 1}</td>,
          maxSchedule: (content) => <td style={{ width: '60px' }}>{content.config && 'maxSchedule' in content.config ? content.config.maxSchedule : 0}</td>,
          request: (content) => <td style={{ width: '80px' }}>{content.delivStats ? formatInteger(content.delivStats.request) : '0'}</td>,
          open: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-info"> {content.delivStats ? formatInteger(content.delivStats.unique_open) : '0'}</span>

              {content.delivStats && content.delivStats.unique_open > 0 && (
                <small className="text-muted">&nbsp;({calculateAndFormatPercent(content.delivStats.unique_open, content.delivStats.request)})</small>
              )}
            </td>
          ),
          click: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-success"> {content.delivStats ? formatInteger(content.delivStats.unique_click) : '0'}</span>
              {content.delivStats && content.delivStats.unique_click > 0 && (
                <small className="text-muted">&nbsp;({calculateAndFormatPercent(content.delivStats.unique_click, content.delivStats.request)})</small>
              )}
            </td>
          ),
          unsub: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-warning">{content.delivStats ? formatInteger(content.delivStats.unsub) : '0'}</span>
              {content.delivStats && content.delivStats.unsub > 0 && <small className="text-muted">&nbsp;({calculateAndFormatPercent(content.delivStats.unsub, content.delivStats.request)})</small>}
            </td>
          ),
          refUnsubRate: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-warning">
                {content.delivStats
                  ? content.externalStats && content.externalStats.ref_requests > 0
                    ? calculateAndFormatPercent(content.externalStats.ref_unsubscribed, content.externalStats.ref_opened)
                    : calculateAndFormatPercent(content.delivStats.unsub, content.delivStats.unique_open)
                  : ''}
              </span>
            </td>
          ),
          complaint: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-danger">{content.delivStats ? formatInteger(content.delivStats.complaint) : '0'}</span>
              {content.delivStats && content.delivStats.complaint > 0 && (
                <small className="text-muted">&nbsp;({calculateAndFormatPercent(content.delivStats.complaint, content.delivStats.request)})</small>
              )}
            </td>
          ),
          refComplaintRate: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-danger">
                {content.delivStats
                  ? content.externalStats && content.externalStats.ref_requests > 0
                    ? calculateAndFormatPercent(content.externalStats.ref_complainted, content.externalStats.ref_opened)
                    : calculateAndFormatPercent(content.delivStats.complaint, content.delivStats.unique_open)
                  : '0'}
              </span>
            </td>
          ),
          eCpm: (content) => (
            <td style={{ width: '100px' }}>
              <span className="text-success"> {content.incomesStats && content.incomesStats.total != null ? formatFloat(content.incomesStats.total.eCpm) + ' €' : ''}</span>
            </td>
          ),
          actions: (content) => (
            <td
              onClick={(event) => {
                event.stopPropagation();
                event.nativeEvent.stopPropagation();
              }}
            >
              {cloneContent && (
                <i
                  className="pl-2 pr-1 fas  fa-clone"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    cloneContent(content);
                  }}
                ></i>
              )}
              {canDeleteContent(content) && (
                <i
                  className="pl-2 pr-1 fas  fa-trash"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    confirmAlert({
                      customUI: ({ onClose }) => {
                        return (
                          <CCard className="card-accent-danger">
                            <CCardHeader>Are you sure?</CCardHeader>
                            <CCardBody>
                              <p>You want to delete this content?</p>
                            </CCardBody>
                            <CCardFooter>
                              <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                                No
                              </CButton>
                              <CButton
                                color="danger"
                                className="px-5"
                                onClick={() => {
                                  deleteContent(emailingDatabaseApiContext, contents, content, forceUpdate);
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
                ></i>
              )}
              {isSuperAdmin && !content.suspended && (
                <i
                  className="pl-2 pr-1 fas  fa-hand-paper"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setShowModalSuspend(content);
                  }}
                ></i>
              )}
            </td>
          ),
          createdAt: (content) => <td style={{ width: '100px' }}>{content.createdAt ? moment(content.createdAt).format('YYYY/MM/DD') : ''}</td>
        }}
      />
    </>
  );
};
