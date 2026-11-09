import { useMutation } from '@apollo/client';
import React, { useState } from 'react';
import gql from 'graphql-tag';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

import { Col, Row } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { getSignedClient } from '../../services/AccessManager/AccessManager';

export default ({ show, setShow }) => {
  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const selectedEntreprise = useSelector((state) => state.entreprise);

  const [createUserEntreprise, { loading }] = useMutation(
    gql`
      mutation createUserEntreprise($input: CreateUserEntrepriseInput!) {
        createUserEntreprise(input: $input) {
          userEntreprise {
            id
          }
        }
      }
    `,
    {
      client: getSignedClient()
    }
  );

  return (
    <Modal
      show={show}
      onHide={() => {
        setShow(false);
      }}
    >
      <Modal.Header>Invite new user</Modal.Header>
      <Modal.Body>
        <Row className="py-3">
          <Col sm="12">
            <input
              className="form-control form-control-sm"
              type="text"
              placeholder="Email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          </Col>
        </Row>
        <Row>
          <Col sm="6">
            <input
              className="form-control form-control-sm"
              type="text"
              placeholder="Firstname"
              value={firstname}
              onChange={(event) => {
                setFirstname(event.target.value);
              }}
            />
          </Col>
          <Col sm="6">
            <input
              className="form-control form-control-sm"
              type="text"
              placeholder="Lastname"
              value={lastname}
              onChange={(event) => {
                setLastname(event.target.value);
              }}
            />
          </Col>
        </Row>
      </Modal.Body>

      <Modal.Footer>
        <Button
          className="btn-sm"
          variant="secondary"
          onClick={() => {
            setShow(false);
          }}
        >
          Close
        </Button>
        <Button
          className="btn-sm"
          variant="primary"
          disabled={!email || loading}
          onClick={async () => {
            let result = await createUserEntreprise({
              variables: {
                input: {
                  email,
                  firstname,
                  lastname,
                  entrepriseId: selectedEntreprise.id
                }
              }
            });

            if (result && result.data) {
              setShow(false);
            }
          }}
        >
          Invite
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
