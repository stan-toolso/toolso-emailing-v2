import React, { useState } from 'react';

import { getClient } from '../../services/AccessManager/AccessManager';
import { gql, useMutation } from '@apollo/client';
import { Card, Container } from 'react-bootstrap';
import { Row } from 'react-bootstrap';
import { Col } from 'react-bootstrap';
import { Form } from 'react-bootstrap';

import { Button } from 'react-bootstrap';

const Reset = () => {
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(null);
  const [loading, setLoading] = useState(null);

  const [doRequestNewResetLink] = useMutation(
    gql`
      mutation requestNewResetLink($email: String!) {
        requestNewResetLink(email: $email)
      }
    `,
    {
      client: getClient()
    }
  );

  return (
    <div className="c-app c-default-layout flex-row align-items-center">
      <Container>
        <Row className="justify-content-center">
          <Col md="8">
            <div className="card-group">
              <Card className="p-4" style={{ minHeight: '300px' }}>
                <Card.Body>
                  <h1>Password recovery</h1>

                  {confirmed === null && (
                    <>
                      <div className="my-4">Enter your login email address to receive an email to reset your password.</div>

                      <div className="input-group mb-4">
                        <div className="input-group-prepend">
                          <div className="input-group-text">
                            <i className="fas fa-user"></i>
                          </div>
                        </div>
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder="Email address"
                          onChange={(event) => {
                            setEmail(event.target.value);
                          }}
                          value={email}
                        />
                      </div>

                      <Button
                        size="sm"
                        color="primary"
                        className="mt-2"
                        disabled={loading}
                        onClick={async () => {
                          setLoading(true);

                          await doRequestNewResetLink({
                            variables: {
                              email: email
                            }
                          });
                          setConfirmed(true);

                          setLoading(false);
                        }}
                      >
                        Send Email
                      </Button>
                    </>
                  )}

                  {confirmed && (
                    <div className="my-4">
                      Instructions have been sent to the email address associated with this Toolso account. Check that email and follow the instructions to reset your password.
                    </div>
                  )}
                </Card.Body>
              </Card>
              <Card className="text-white bg-primary py-5 d-md-down-none" style={{ width: '44%' }}>
                <Card.Body>
                  <div>
                    <img
                      alt="Toolso Logo"
                      src="/img/toolso_logo_white_300.png"
                      style={{
                        width: '80px',
                        margin: '20px auto',
                        display: 'block'
                      }}
                    />
                    <h2 className="text-center">Toolso Emailing</h2>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Reset;
