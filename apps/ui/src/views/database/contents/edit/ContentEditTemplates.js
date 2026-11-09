import { gql, useMutation } from '@apollo/client';
import { CSwitch } from '@coreui/react';
import React, { useContext, useState } from 'react';

import { Col, Nav, Row, Tab } from 'react-bootstrap';
import ContentEditTemplate from './ContentEditTemplate';
import { updateContentVersion } from '../util';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';

export default ({ content, forceUpdate }) => {
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [activeKey, setActiveKey] = useState(0);

  const [createContentVersion] = useMutation(gql`
    mutation createContentVersion($contentId: ID!) {
      createContentVersion(contentId: $contentId) {
        id
        name
      }
    }
  `);
  const [deleteContentVersion] = useMutation(gql`
    mutation deleteContentVersion($contentVersionId: ID!) {
      deleteContentVersion(contentVersionId: $contentVersionId)
    }
  `);

  const [cloneContentVersion] = useMutation(gql`
    mutation cloneContentVersion($contentVersionId: ID!) {
      cloneContentVersion(contentVersionId: $contentVersionId) {
        id
        name
        html
        subject
        frenchEspsSubject
        senderName
        disabled
        contentTemplate {
          id
          name
          subject
          senderName
          frenchEspsSubject
        }
        templateVariables
      }
    }
  `);

  return (
    <>
      <Tab.Container
        id="left-tabs-example"
        activeKey={activeKey}
        onSelect={(key) => {
          setActiveKey(key);
        }}
      >
        <Row>
          <Col sm={8}>
            <Tab.Content>
              {content.versions.map((version, index) => {
                return (
                  <Tab.Pane eventKey={index} key={index}>
                    <ContentEditTemplate key={index} content={content} contentVersion={version} forceUpdate={forceUpdate} />
                  </Tab.Pane>
                );
              })}
            </Tab.Content>
          </Col>
          <Col sm={4} className="border-left">
            <Nav variant="pills" className="flex-column">
              {content.versions.map((version, index) => {
                return (
                  <Nav.Item key={index}>
                    <div className={'pt-2 pr-2 pl-2'} style={{ position: 'absolute' }}>
                      <CSwitch
                        color={'primary'}
                        variant={'3d'}
                        size="sm"
                        labelOn={'\u2713'}
                        labelOff={'\u2715'}
                        checked={version.disabled ? false : true}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                        }}
                        onChange={async (event) => {
                          await updateContentVersion(
                            emailingDatabaseApiContext,
                            version,
                            { disabled: !event.target.checked },
                            !event.target.checked ? 'Version has been disabled' : 'Version has been enabled',
                            forceUpdate
                          );
                        }}
                      />
                    </div>
                    <Nav.Link eventKey={index} className={'pl-5'}>
                      <div className="float-right">
                        <i
                          className="far fa-clone pl-2"
                          onClick={async (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            let result = await cloneContentVersion({ variables: { contentVersionId: version.id } });

                            if (result && result.data && result.data.cloneContentVersion) {
                              content.versions.push(result.data.cloneContentVersion);
                              forceUpdate();
                              setActiveKey(content.versions.length - 1);
                            }
                          }}
                        />
                        {content.versions.length >= 2 && (
                          <i
                            className="fas fa-trash pl-2"
                            onClick={async (event) => {
                              event.stopPropagation();
                              event.preventDefault();

                              let result = await deleteContentVersion({ variables: { contentVersionId: version.id } });

                              if (result && result.data && result.data.deleteContentVersion) {
                                content.versions.splice(index, 1);
                                forceUpdate();
                                setActiveKey(Math.min(activeKey, content.versions.length - 1));
                              }
                            }}
                          />
                        )}
                      </div>
                      #{version.id} - {version.name}
                    </Nav.Link>
                  </Nav.Item>
                );
              })}

              <Nav.Item>
                <Nav.Link
                  onClick={async () => {
                    let result = await createContentVersion({ variables: { contentId: content.id } });
                    if (result && result.data && result.data.createContentVersion) {
                      content.versions.push(result.data.createContentVersion);
                      forceUpdate();
                      setActiveKey(content.versions.length - 1);
                    }
                  }}
                >
                  <i className="fas fa-plus"></i> Add new version
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>
      </Tab.Container>
    </>
  );
};
