import React, { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { CButton, CCol, CFormGroup, CInput, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CRow, CSpinner, CSelect } from '@coreui/react';
import gql from 'graphql-tag';
import CampainManagerApi from '../../services/CampaignManagerApi';
import { contentTypeLabels, contentTypeKeys } from '../database/contents/ContentsTypes';

export default (props) => {
  const show = props.show;
  const toggle = props.toggle;
  const enterpriseId = parseInt(props.enterpriseId);

  const defaultType = contentTypeKeys.marketing;

  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);

  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const create = useCallback(() => {
    (async () => {
      setLoading(true);
      let query = {
        mutation: gql`
          mutation CreateCampaign($name: String!, $type: String, $enterpriseId: Int!) {
            createCampaign(name: $name, type: $type, enterprise_id: $enterpriseId) {
              id
            }
          }
        `,
        variables: {
          name: name,
          type: type,
          enterpriseId: enterpriseId
        }
      };
      let result = await CampainManagerApi.doMutation(query);
      if (result && result.data) {
        let campaignId = result.data.createCampaign.id;
        toggle();
        history.push(`/campaigns/list/${campaignId}`);
      }
      setLoading(false);
    })();
  }, [name, setLoading, history, toggle, type, enterpriseId]);

  return (
    <CModal show={show} color="info" onClose={toggle}>
      <CModalHeader>{'New campaign creation'}</CModalHeader>
      <CModalBody>
        <CRow>
          <CCol lg="8">
            <CFormGroup>
              <CLabel htmlFor="name">Choose your campaign name</CLabel>
              <CInput
                type="text"
                id="name"
                placeholder="Campaign name"
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
          {'Save'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};
