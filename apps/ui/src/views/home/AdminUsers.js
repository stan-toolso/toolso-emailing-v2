import { useMutation, useQuery } from '@apollo/client';
import { CButton } from '@coreui/react';
import gql from 'graphql-tag';
import React, { useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import Card from 'react-bootstrap/Card';
import { confirmAlert } from 'react-confirm-alert'; // Import
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { useSelector } from 'react-redux';
import Switch from 'react-switch';
import { getSignedClient } from '../../services/AccessManager/AccessManager';
import InviteUserModal from './InviteUserModal';
import { toast } from 'react-toastify';

export default () => {
  const [showModal, setShowModal] = useState(false);

  const selectedEntreprise = useSelector((state) => state.entreprise);

  const { loading, data, refetch } = useQuery(
    gql`
      query entreprise($id: ID!) {
        entreprise(id: $id) {
          id
          name
          users {
            id
            role
            disabled
            pending
            user {
              id
              email
              firstname
              lastname
            }
          }
        }
      }
    `,
    {
      variables: {
        id: selectedEntreprise.id
      },
      client: getSignedClient()
    }
  );

  const [updateUserEntreprise] = useMutation(
    gql`
      mutation UpdateUserEntreprise($input: UpdateUserEntrepriseInput!) {
        updateUserEntreprise(input: $input) {
          userEntreprise {
            id
            role
            disabled
          }
        }
      }
    `,
    {
      client: getSignedClient()
    }
  );
  const [removeUserEntreprise] = useMutation(
    gql`
      mutation RemoveUserEntreprise($input: RemoveUserEntrepriseInput!) {
        removeUserEntreprise(input: $input) {
          status
        }
      }
    `,
    {
      client: getSignedClient()
    }
  );

  let entreprise = data && data.entreprise ? data.entreprise : null;
  return (
    <Card>
      <Card.Header>
        <div className="d-flex ">
          <div>Users</div>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="d-flex flex-row-reverse bd-highlight mb-2">
          <InviteUserModal
            show={showModal}
            setShow={(show) => {
              if (!show) {
                refetch();
              }
              setShowModal(show);
            }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowModal(true);
            }}
          >
            Invite user
          </button>
        </div>

        <table className="table ">
          <thead>
            <tr>
              <th>Email</th>
              <th>Firstname</th>
              <th>Lastname</th>
              <th>Role</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          {loading && (
            <tbody>
              <tr>
                <td colSpan={6}>
                  <div
                    style={{
                      textAlign: 'center',
                      height: '160px',
                      padding: '50px 0px'
                    }}
                  >
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  </div>
                </td>
              </tr>
            </tbody>
          )}
          {!loading &&
            entreprise &&
            entreprise.users.map((userItem, index) => {
              let user = userItem.user;
              return (
                <tbody key={index}>
                  <tr key={index}>
                    <td>{user.email}</td>
                    <td>{user.firstname}</td>
                    <td>{user.lastname}</td>
                    <td>
                      <select
                        className="form-control form-control-sm"
                        value={userItem.role}
                        onChange={async (event) => {
                          if (event.target.value) {
                            await updateUserEntreprise({
                              variables: {
                                input: {
                                  userEntreprise: {
                                    id: userItem.id,
                                    role: event.target.value
                                  }
                                }
                              }
                            });

                            refetch();
                            toast.success(`User role for [${user.email}] has been updated `, {
                              position: toast.POSITION.BOTTOM_RIGHT
                            });
                          }
                        }}
                        style={{ width: '100px' }}
                      >
                        <option>Select the role</option>
                        <option value="admin">Admin</option>
                        <option value="worker">Worker</option>
                      </select>
                    </td>
                    <td>
                      <Switch
                        onChange={async (checked) => {
                          await updateUserEntreprise({
                            variables: {
                              input: {
                                userEntreprise: {
                                  id: userItem.id,
                                  disabled: !checked
                                }
                              }
                            }
                          });
                          refetch();
                        }}
                        checked={!userItem.disabled}
                        uncheckedIcon={false}
                        checkedIcon={false}
                        height={18}
                        width={35}
                      />
                    </td>
                    <td>
                      <i
                        className="pl-2 pr-1 fas  fa-trash"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          confirmAlert({
                            customUI: ({ onClose }) => {
                              return (
                                <Card className="card-accent-danger">
                                  <Card.Header>Are you sure?</Card.Header>
                                  <Card.Body>
                                    <p>You want to delete this user?</p>
                                  </Card.Body>
                                  <Card.Footer>
                                    <CButton color="secondary" onClick={onClose} className="px-5 mr-3">
                                      No
                                    </CButton>
                                    <CButton
                                      color="danger"
                                      className="px-5"
                                      onClick={async () => {
                                        await removeUserEntreprise({
                                          variables: {
                                            input: {
                                              id: userItem.id
                                            }
                                          }
                                        });
                                        refetch();
                                        onClose();
                                      }}
                                    >
                                      Yes, Delete it!
                                    </CButton>
                                  </Card.Footer>
                                </Card>
                              );
                            }
                          });
                        }}
                      ></i>
                    </td>
                  </tr>
                </tbody>
              );
            })}
        </table>
      </Card.Body>
    </Card>
  );
};
