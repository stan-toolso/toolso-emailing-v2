import React, { useState, useEffect } from 'react';
import { getClient, EventType } from '../../services/AccessManager/AccessManager';
import { emit } from '../../services/AppEvents/AppEvents';
import { gql, useMutation } from '@apollo/client';

import { CButton, CCard, CCardBody, CCardGroup, CCol, CContainer, CForm, CInput, CInputGroup, CInputGroupPrepend, CInputGroupText, CRow } from '@coreui/react';
import CIcon from '@coreui/icons-react';

import ForgotPasswordModal from './ForgotPasswordModal';

const Login = () => {
  const [authError, setAuthError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [data, setData] = useState();
  const [showForgotForm, setShowForgotForm] = useState(false);

  const [doLogin] = useMutation(
    gql`
      mutation authWithPassword($email: String!, $password: String!) {
        authWithPassword(email: $email, password: $password)
      }
    `,
    {
      client: getClient()
    }
  );
  useEffect(() => {
    if (data && data.authWithPassword) {
      emit(EventType.new_token, data.authWithPassword);
    }
  }, [data]);

  return (
    <>
      <ForgotPasswordModal
        show={showForgotForm}
        toggle={() => {
          setShowForgotForm(false);
        }}
        email={username}
      />
      <div className="c-app c-default-layout flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md="8">
              <CCardGroup>
                <CCard className="p-4">
                  <CCardBody>
                    <CForm>
                      <h1>Login</h1>
                      <p className="text-muted">Sign In to your account</p>
                      <CInputGroup className="mb-3">
                        <CInputGroupPrepend>
                          <CInputGroupText>
                            <CIcon name="cil-user" />
                          </CInputGroupText>
                        </CInputGroupPrepend>
                        <CInput type="text" invalid={authError !== null} placeholder="Username" autoComplete="username" onChange={(event) => setUsername(event.target.value)} value={username} />
                      </CInputGroup>
                      <CInputGroup className="mb-4">
                        <CInputGroupPrepend>
                          <CInputGroupText>
                            <CIcon name="cil-lock-locked" />
                          </CInputGroupText>
                        </CInputGroupPrepend>
                        <CInput
                          type="password"
                          invalid={authError !== null}
                          onChange={(event) => setPassword(event.target.value)}
                          value={password}
                          placeholder="Password"
                          autoComplete="current-password"
                        />
                      </CInputGroup>
                      <CRow>
                        <CCol xs="6" className="d-flex">
                          <CButton
                            color="primary"
                            className="px-4"
                            style={{ height: '40px' }}
                            key="login"
                            onClick={async () => {
                              try {
                                const { data } = await doLogin({
                                  variables: {
                                    email: username,
                                    password: password
                                  }
                                });
                                setData(data);
                              } catch (err) {
                                setAuthError(err);
                                console.log(err);
                              }
                            }}
                          >
                            Login
                          </CButton>
                          <a
                            size="sm"
                            className="c-sidebar-nav-link"
                            style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={async () => {
                              setShowForgotForm(true);
                            }}
                          >
                            Forgot password ?
                          </a>
                        </CCol>
                      </CRow>
                    </CForm>
                  </CCardBody>
                </CCard>
                <CCard className="text-white bg-primary py-5 d-md-down-none" style={{ width: '44%' }}>
                  <CCardBody className="text-center">
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
                  </CCardBody>
                </CCard>
              </CCardGroup>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    </>
  );
};

export default Login;
