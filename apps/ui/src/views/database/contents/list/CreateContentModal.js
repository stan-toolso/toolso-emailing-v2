import React, { useState, useContext, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner, CSelect } from '@coreui/react';

import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { contentTypeLabels } from '../ContentsTypes';
import { CREATE_CONTENT, DUPLICATE_CONTENT } from '../../../../services/DatabaseQuery';
import { useSettings } from '../../../common/Settings';

export default (props) => {
  const contentToClone = props.contentToClone;
  const show = props.show;
  const toggle = props.toggle;
  const replay = props.replay;
  const prefix = replay ? 'Replay' : 'Copy of';
  const [defaultType] = useSettings('default_content_type');

  const [name, setName] = useState(contentToClone ? `${prefix} ${contentToClone.name}` : '');
  const [type, setType] = useState(contentToClone ? contentToClone.type : defaultType);

  const [loading, setLoading] = useState(false);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const history = useHistory();
  useEffect(() => {
    setName(props.contentToClone ? `${prefix} ${props.contentToClone.name}` : '');
    if (props.contentToClone) {
      setType(props.contentToClone.type);
    }
  }, [props.contentToClone, prefix, setName, setType]);

  useEffect(() => {
    if (!type) {
      setType(defaultType);
    }
  }, [props.contentToClone, defaultType, type, setType]);

  const create = useCallback(() => {
    (async () => {
      setLoading(true);
      let query = contentToClone
        ? {
            query: DUPLICATE_CONTENT,
            variables: {
              contentId: contentToClone.id,
              name: name,
              type: type
            }
          }
        : {
            query: CREATE_CONTENT,
            variables: {
              name: name,
              type: type
            }
          };
      let result = await emailingDatabaseApiContext.doQuery(query);
      if (result && result.data) {
        let contentId = contentToClone ? result.data.duplicateContent.id : result.data.createContent.id;
        toggle();
        history.push(`/${emailingDatabaseApiContext.getUid()}/contents/list/${contentId}`);
      }
      setLoading(false);
    })();
  }, [emailingDatabaseApiContext, name, setLoading, contentToClone, history, toggle, type]);

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>{contentToClone ? 'Duplicate ' + contentToClone.name : 'New content creation'}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol lg="8">
            <CFormGroup>
              <CLabel htmlFor="name">Choose your content name</CLabel>
              <CInput
                type="text"
                id="name"
                placeholder="Content name"
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              ></CInput>
            </CFormGroup>
          </CCol>
          <CCol lg="4">
            <CFormGroup>
              <CLabel htmlFor="name">Choose your type</CLabel>
              <CSelect
                className="form-control mr-1 mt-1"
                size="sm"
                value={type ? type : ''}
                onChange={(event) => {
                  setType(event.target.value);
                }}
              >
                {Object.keys(contentTypeLabels).map((key) => {
                  return (
                    <option value={key} key={key}>
                      {contentTypeLabels[key]}
                    </option>
                  );
                })}
              </CSelect>
            </CFormGroup>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton onClick={toggle}>Cancel</CButton>
        <CButton color="info" onClick={create}>
          {loading && <CSpinner color="secondary" />}
          {contentToClone ? 'Duplicate' : 'Save'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
