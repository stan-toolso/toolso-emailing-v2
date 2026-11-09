import React, { useState, useEffect } from 'react';

import { toast } from 'react-toastify';
import { useMutation, useQuery } from '@apollo/client';

import gql from 'graphql-tag';
import Pagination from '../../../common/Pagination';

import MessageTable from './MessageTable';
import RangeDatePicker from '../../../common/RangeDatePicker';
import { CButton, CCol, CRow } from '@coreui/react';
import { useSelector } from 'react-redux';

const CONTACT_MESSAGES = gql`
  query contactMessages($limit: Int, $offset: Int, $filter: JSON) {
    contactMessages(limit: $limit, offset: $offset, filter: $filter) {
      total
      limit
      offset
      messages {
        id
        date
        title
        from
        to
        status
        extract
        contact {
          id
          email
        }
      }
    }
  }
`;

export default () => {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState(sessionStorage.getItem('MESSAGE_LIST_FILTER') ? JSON.parse(sessionStorage.getItem('MESSAGE_LIST_FILTER')) : {});
  const [messages, setMessages] = useState([]);

  const user = useSelector((state) => state.user);

  useEffect(() => {
    sessionStorage.setItem('MESSAGE_LIST_FILTER', JSON.stringify(filter));
  }, [filter]);

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const { loading, data } = useQuery(CONTACT_MESSAGES, {
    variables: {
      limit: limit,
      offset: offset,
      filter: {
        ...filter,
        sendFromToolso: false,
        fromDate: fromDate ? fromDate.format('YYYY-MM-DD') : null,
        toDate: toDate ? toDate.format('YYYY-MM-DD') : null
      }
    },
    skip: !fromDate || !toDate,
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    if (data) {
      setTotal(data.contactMessages.total);
      setMessages(JSON.parse(JSON.stringify(data.contactMessages.messages)));
    } else {
      setMessages([]);
      setTotal(0);
    }
  }, [setTotal, setMessages, data]);

  let hasOneElementSelect = messages
    ? messages.filter((message) => {
        return message.checked;
      }).length > 0
    : false;

  const [updateContactMessage] = useMutation(gql`
    mutation updateContactMessage($message: JSON!) {
      updateContactMessage(message: $message) {
        id
      }
    }
  `);

  const [blacklistContact] = useMutation(gql`
    mutation blacklistContact($id: ID!, $origin: String!, $reason: String!) {
      blacklistContact(id: $id, origin: $origin, reason: $reason) {
        id
      }
    }
  `);

  const [subscribe] = useMutation(gql`
    mutation SubscribeContact($id: ID!) {
      subscribeContact(id: $id) {
        id
      }
    }
  `);

  const [unsubscribe] = useMutation(gql`
    mutation UnsubscribeContact($id: ID!) {
      unsubscribeContact(id: $id) {
        id
      }
    }
  `);

  return (
    <>
      <CRow className="mb-0">
        <CCol sm="6">
          <RangeDatePicker className="d-flex flex-fill justify-content-end" defaultRangeType="last20Days" fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />
        </CCol>

        <CCol sm="6">
          <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} />
        </CCol>
      </CRow>

      <div>
        <CButton
          size="sm"
          color="success"
          className="float-left mr-1 my-1 "
          onClick={async () => {
            await Promise.all(
              messages.map((message) => {
                if (!message.checked) {
                  return null;
                }
                return new Promise((resolve) => {
                  message.status = 'done';
                  updateContactMessage({ variables: { message } }).finally(resolve);
                });
              })
            );
            setMessages([...messages]);
          }}
          disabled={!hasOneElementSelect}
        >
          Mark as Done
        </CButton>
        <CButton
          size="sm"
          color="warning"
          className="float-left mr-1 my-1 "
          onClick={async () => {
            await Promise.all(
              messages.map((message) => {
                if (!message.checked) {
                  return null;
                }
                return new Promise((resolve) => {
                  message.status = 'pending';
                  updateContactMessage({ variables: { message } }).finally(resolve);
                });
              })
            );
            setMessages([...messages]);
          }}
          disabled={!hasOneElementSelect}
        >
          Mark as Pending
        </CButton>

        <CButton
          size="sm"
          color="success"
          className="float-left mr-1 my-1 "
          onClick={async () => {
            await Promise.all(
              messages.map((message) => {
                if (!message.checked) {
                  return null;
                }
                return new Promise((resolve) => {
                  if (message.contact && message.contact.id) {
                    subscribe({
                      variables: { id: message.contact.id }
                    }).finally(() => {
                      toast.success(`Contact ${message.contact.email} has been subscribed`, {
                        position: toast.POSITION.BOTTOM_RIGHT
                      });
                      resolve();
                    });
                  } else {
                    toast.warning(`Message #${message.id} doesn't have contact attached.`, {
                      position: toast.POSITION.BOTTOM_RIGHT
                    });
                    resolve();
                  }
                });
              })
            );
            setMessages([...messages]);
          }}
          disabled={!hasOneElementSelect}
        >
          Subscribe
        </CButton>

        <CButton
          size="sm"
          color="danger"
          className="float-left mr-1 my-1 "
          onClick={async () => {
            await Promise.all(
              messages.map((message) => {
                if (!message.checked) {
                  return null;
                }
                return new Promise((resolve) => {
                  if (message.contact && message.contact.id) {
                    unsubscribe({
                      variables: { id: message.contact.id }
                    }).finally(() => {
                      toast.success(`Contact ${message.contact.email} has been unsub`, {
                        position: toast.POSITION.BOTTOM_RIGHT
                      });
                      resolve();
                    });
                  } else {
                    toast.warning(`Message #${message.id} doesn't have contact attached.`, {
                      position: toast.POSITION.BOTTOM_RIGHT
                    });
                    resolve();
                  }
                });
              })
            );
            setMessages([...messages]);
          }}
          disabled={!hasOneElementSelect}
        >
          Unsubscribe
        </CButton>

        <CButton
          size="sm"
          color="danger"
          className="float-left mr-1 my-1 "
          onClick={async () => {
            await Promise.all(
              messages.map((message) => {
                if (!message.checked) {
                  return null;
                }
                return new Promise((resolve) => {
                  if (message.contact && message.contact.id) {
                    blacklistContact({
                      variables: {
                        id: message.contact.id,
                        origin: `Toolso Emailing Website - Contact detail - Blacklisted by ${user.email}`,
                        reason: ''
                      }
                    }).finally(() => {
                      toast.success(`Contact ${message.contact.email} has been blacklisted`, {
                        position: toast.POSITION.BOTTOM_RIGHT
                      });
                      resolve();
                    });
                  } else {
                    toast.warning(`Message #${message.id} doesn't have contact attached.`, {
                      position: toast.POSITION.BOTTOM_RIGHT
                    });
                    resolve();
                  }
                });
              })
            );
            setMessages([...messages]);
          }}
          disabled={!hasOneElementSelect}
        >
          Blacklist
        </CButton>
      </div>
      <MessageTable
        loading={loading}
        messages={messages}
        showContactInfo={true}
        filter={filter}
        setFilter={setFilter}
        setMessages={(items) => {
          setMessages([...items]);
        }}
      />

      <div className="mt-2">
        <Pagination offset={offset} limit={limit} total={total} setOffset={setOffset} setLimit={setLimit} showSelectPageSection={true} />
      </div>
    </>
  );
};
