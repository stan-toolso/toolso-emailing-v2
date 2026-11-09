import React, { useState } from 'react';
import { emit } from '../../services/AppEvents/AppEvents';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Card, Container, Spinner } from 'react-bootstrap';
import { Row } from 'react-bootstrap';
import { Col } from 'react-bootstrap';
import { Form } from 'react-bootstrap';
import { Link, useHistory, useParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { getClient, EventType } from '../../services/AccessManager/AccessManager';

const Join = () => {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const { token } = useParams();

  const [reseting, setReseting] = useState(false);
  let history = useHistory();

  const { loading, data } = useQuery(
    gql`
      query meWithToken($token: String!) {
        meWithToken(token: $token) {
          id
          email
        }
      }
    `,
    {
      variables: {
        token
      },
      client: getClient()
    }
  );

  const [resetPassword] = useMutation(
    gql`
      mutation resetPassword($token: String!, $password: String!) {
        resetPassword(token: $token, password: $password) {
          token
          user {
            id
            email
          }
        }
      }
    `,
    {
      client: getClient()
    }
  );

  const user = data && data.meWithToken ? data.meWithToken : null;

  return (
    <div className="c-app c-default-layout flex-row align-items-center">
      <Container>
        <Row className="justify-content-center">
          <Col md="8">
            <div className="card-group">
              <Card className="p-4" style={{ minHeight: '300px' }}>
                <Card.Body>
                  <h1>Choose password</h1>
                  {loading && (
                    <>
                      <div style={{ textAlign: 'center', padding: '50px 0px' }}>
                        <Spinner animation="grow" color="secondary" />
                      </div>
                    </>
                  )}
                  {!loading && !user && (
                    <>
                      This password reset link has expired. You can request a new one, or you can&nbsp;
                      <Link to={'/login'} className="text-underline">
                        login
                      </Link>{' '}
                      with your existing password.
                      <Link className="btn btn-sm btn-primary mt-3" to={'/reset'}>
                        Request a new Link
                      </Link>
                    </>
                  )}
                  {!loading && user && (
                    <>
                      <p className="text-muted">Choose your app password</p>

                      <div className="input-group mb-4">
                        <div className="input-group-prepend">
                          <div className="input-group-text">
                            <i className="fas fa-user"></i>
                          </div>
                        </div>
                        <Form.Control type="text" disabled={true} value={user ? user.email : ''} />
                      </div>

                      <div className="input-group mb-4">
                        <div className="input-group-prepend">
                          <div className="input-group-text">
                            <i className="fas fa-key"></i>
                          </div>
                        </div>
                        <Form.Control type="password" onChange={(event) => setPassword(event.target.value)} value={password} placeholder="Password" />
                      </div>

                      <div className="input-group mb-4">
                        <div className="input-group-prepend">
                          <div className="input-group-text">
                            <i className="fas fa-key"></i>
                          </div>
                        </div>
                        <Form.Control type="password" onChange={(event) => setPasswordConfirm(event.target.value)} value={passwordConfirm} placeholder="Confirm Password" />
                      </div>

                      <Button
                        size="sm"
                        color="primary"
                        className="mt-2"
                        disabled={reseting || password !== passwordConfirm}
                        onClick={async () => {
                          setReseting(true);

                          let data = await resetPassword({
                            variables: {
                              token,
                              password
                            }
                          });
                          if (data && data.data.resetPassword && data.data.resetPassword.token) {
                            emit(EventType.new_token, data.data.resetPassword.token);
                            history.push('/');
                          } else {
                            toast.error('Failed to set your password.', {
                              position: toast.POSITION.BOTTOM_RIGHT
                            });
                          }

                          setReseting(false);
                        }}
                      >
                        Set password
                      </Button>
                    </>
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
                    <h2>Toolso Emailing</h2>
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

export default Join;
