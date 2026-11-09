import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import React, { useEffect, useState } from 'react';

import { Card, Spinner } from 'react-bootstrap';
import { EspOptions } from '../../../common/EspOptions';
import ActivationConfig from './ActivationConfig';

export default () => {
  const [configs, setConfigs] = useState([]);
  const [esp, setEsp] = useState('');
  const { loading, data } = useQuery(
    gql`
      query activationConfigs {
        activationConfigs {
          esp
          date
          config
        }
      }
    `,
    {
      variables: {},
      fetchPolicy: 'no-cache'
    }
  );
  useEffect(() => {
    let configs = [];
    if (data && data.activationConfigs) {
      configs = data.activationConfigs;
      setConfigs(configs);
    }
  }, [data, setConfigs]);

  return (
    <Card>
      <Card.Header>Activation Configurations</Card.Header>
      <Card.Body>
        {loading && (
          <div style={{ textAlign: 'center', padding: '50px 0px' }}>
            <Spinner animation="grow" color="secondary" size="sm" />
          </div>
        )}
        {!loading && (
          <div className="table-responsive" style={{ paddingBottom: '200px' }}>
            <table className="table  m-0 table-bordered ">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Esp</th>
                  <th style={{ width: '150px' }}>WM capping</th>
                  <th style={{ width: '150px' }}>News ratio</th>
                  <th colSpan={5} style={{ width: '100%' }}></th>
                </tr>
              </thead>

              {configs.length == 0 && (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      <div style={{ textAlign: 'center' }}>You don&apos;t have any activation configuration</div>
                    </td>
                  </tr>
                </tbody>
              )}
              {configs.map((item, index) => {
                return <ActivationConfig activationConfig={item} key={index} />;
              })}
              <tbody>
                <tr>
                  <td colSpan={8}>
                    <select
                      className="form-control form-control-sm d-inline-block mr-1"
                      style={{ width: '200px' }}
                      value={esp}
                      onChange={(e) => {
                        setEsp(e.target.value);
                      }}
                    >
                      <option>Select an esp</option>
                      {EspOptions.filter((item) => {
                        return (
                          configs.filter((config) => {
                            return config.esp == item.value;
                          }).length <= 0
                        );
                      }).map((item, index) => {
                        return (
                          <option key={index} value={item.value}>
                            {item.label}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      disabled={esp === ''}
                      className="btn btn-primary btn-sm d-inline-block"
                      onClick={() => {
                        setConfigs([...configs, { esp: esp, config: {} }]);
                      }}
                    >
                      Create Esp configuration
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
