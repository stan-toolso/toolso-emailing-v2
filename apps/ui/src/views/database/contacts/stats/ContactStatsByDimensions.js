import { useQuery } from '@apollo/client';
import React, { useState } from 'react';
import ContactFilterEditor from '../ContactFilterEditor';
import gql from 'graphql-tag';
import { CButton, CSpinner } from '@coreui/react';
import Select from 'react-select';
import { calculatePercent, formatFloat } from '../../../common/util';
import Alert from 'react-bootstrap/Alert';

const DIMENSIONS = [
  { value: 'esp', label: 'Esp' },
  { value: 'age', label: 'Age' },
  { value: 'gender', label: 'Gender' },
  { value: 'status', label: 'Status' },
  { value: 'lastInscription.collectUrl', label: 'Last Inscription / Collect Url' },
  { value: 'lastInscription.sourceId', label: 'Last Inscription / Source ID' },
  { value: 'lastInscription.inscriptionDate', label: 'Last Inscription / Inscription Date' }
];

const FIELDS = [
  { value: 'count', label: 'Count' },
  { value: 'activityScore', label: 'Activity Score' },
  { value: 'activated', label: 'Contact Activated' },
  { value: 'activationRate', label: 'Activation Rate' },
  { value: 'blacklisted', label: 'Contact Blacklisted' },
  { value: 'unique_click', label: 'Clicks' },
  { value: 'unique_open', label: 'Opens' },
  { value: 'click_rate', label: 'Click Rate' },
  { value: 'open_rate', label: 'Open Rate' },
  { value: 'click_per_contact', label: 'Clicks / Contacts' },
  { value: 'request', label: 'Requests' },
  { value: 'hard_bounce', label: 'Hard bounces' },
  { value: 'soft_bounce', label: 'Soft bounces' },
  { value: 'activityScore.min', label: 'Activity Score / Min' },
  { value: 'activityScore.max', label: 'Activity Score / Max' },
  { value: 'activityScore.avg', label: 'Activity Score / Avg' },
  { value: 'last_inscription_unique_click', label: 'Last Inscription Clicks' },
  { value: 'last_inscription_unique_open', label: 'Last Inscription Opens' },
  { value: 'last_inscription_request', label: 'Last Inscription Requests' },
  { value: 'last_inscription_click_per_contact', label: 'Last Inscription Clicks / Contacts' }
];

const FIELD_MAP = {
  count: null,
  activityScore: 'activityScore',
  activated: 'activated',
  activationRate: 'activated',
  blacklisted: 'blacklisted',
  unique_click: 'stats',
  unique_open: 'stats',
  request: 'stats',
  hard_bounce: 'stats',
  soft_bounce: 'stats',
  open_rate: 'stats',
  click_rate: 'stats',
  click_per_contact: 'stats',
  last_inscription_unique_click: 'last_inscription_stats',
  last_inscription_unique_open: 'last_inscription_stats',
  last_inscription_click_per_contact: 'last_inscription_stats',
  'activityScore.min': 'activityScore',
  'activityScore.max': 'activityScore',
  'activityScore.avg': 'activityScore'
};
const DEFAULT_CELL_STYLE = {
  padding: '1px 2px'
};
export default () => {
  const [filterEdited, setFilterEdited] = useState(localStorage.getItem('contactFilter') ? JSON.parse(localStorage.getItem('contactFilter')) : {});
  const [filter, setFilter] = useState(localStorage.getItem('contactFilter') ? JSON.parse(localStorage.getItem('contactFilter')) : {});
  const [showHelp, setShowHelp] = useState(localStorage.getItem('help_closed.contactStatsByDimension') ? false : true);

  const [dimensions, setDimensions] = useState(localStorage.getItem('contactStatsByDimension.dimensions') ? JSON.parse(localStorage.getItem('contactStatsByDimension.dimensions')) : ['esp']);
  const [fields, setFields] = useState(localStorage.getItem('contactStatsByDimension.fields') ? JSON.parse(localStorage.getItem('contactStatsByDimension.fields')) : ['count']);

  const { loading, data } = useQuery(
    gql`
      query contactStats($filter: JSON!, $dimensions: [String], $fields: [String]) {
        contactsByDimensions(filter: $filter, dimensions: $dimensions, fields: $fields) {
          filter
          dimensions
          fields
          result
        }
      }
    `,
    {
      variables: {
        filter,
        dimensions,
        fields: fields
          .map((field) => FIELD_MAP[field])
          .filter((field) => {
            return field != null;
          })
      },
      skip: dimensions.length == 0 || fields.length == 0
    }
  );
  const stats = data?.contactsByDimensions?.result;

  return (
    <>
      {showHelp && (
        <Alert
          variant="info"
          onClose={() => {
            setShowHelp(false);
            localStorage.setItem('help_closed.contactStatsByDimension', 1);
          }}
          dismissible
        >
          <Alert.Heading>Discover contact statistics by dimensions !</Alert.Heading>
          <ul>
            <li>First define your filter that corresponds to the contact segment you are interested in</li>
            <li>Then specify which dimensions you want to use</li>
            <li>Finally add the value fields you want to analyze</li>
          </ul>
        </Alert>
      )}

      <ContactFilterEditor
        filter={filterEdited}
        setFilter={(newFilter) => {
          localStorage.setItem('contactFilter', JSON.stringify(newFilter));
          setFilterEdited({ ...newFilter });
        }}
      />
      <CButton
        size="sm"
        color="primary"
        className="mb-3"
        onClick={() => {
          setFilter(JSON.parse(JSON.stringify(filterEdited)));
        }}
      >
        Refresh
      </CButton>

      <div className="table-responsive" style={{ minHeight: '300px' }}>
        <table className="table table-sm m-0 stats-table table-bordered " style={{ minWidth: '800px' }}>
          <thead>
            <tr>
              <th style={DEFAULT_CELL_STYLE} colSpan={dimensions.length} className="text-center">
                Dimensions
              </th>
              <th style={DEFAULT_CELL_STYLE} colSpan={fields.length} className="text-center">
                Fields
              </th>
            </tr>
            <tr>
              <td colSpan={dimensions.length}>
                <div style={{ minWidth: '300px' }}>
                  <Select
                    value={DIMENSIONS.filter((option) => {
                      return dimensions && dimensions.indexOf(option.value) >= 0;
                    })}
                    onChange={(values) => {
                      let newDimensions = [];
                      if (values) {
                        for (let value of values) {
                          newDimensions.push(value.value);
                        }
                      }
                      setDimensions(newDimensions);

                      localStorage.setItem('contactStatsByDimension.dimensions', JSON.stringify(newDimensions));
                    }}
                    isMulti={true}
                    options={DIMENSIONS}
                    placeholder="Selectd dimensions"
                  />
                </div>
              </td>
              <td colSpan={fields.length}>
                <div style={{ minWidth: '300px' }}>
                  <Select
                    value={FIELDS.filter((option) => {
                      return fields && fields.indexOf(option.value) >= 0;
                    })}
                    onChange={(values) => {
                      let newFields = [];
                      if (values) {
                        for (let value of values) {
                          newFields.push(value.value);
                        }
                      }
                      localStorage.setItem('contactStatsByDimension.fields', JSON.stringify(newFields));
                      setFields(newFields);
                    }}
                    isMulti={true}
                    options={FIELDS}
                    placeholder="Selectd fields"
                  />
                </div>
              </td>
            </tr>
            <tr>
              {dimensions.map((dimension) => {
                return (
                  <th className="text-left" key={dimension}>
                    <div style={{ padding: '1px 2px' }}>
                      {
                        DIMENSIONS.find((d) => {
                          return d.value == dimension;
                        }).label
                      }
                    </div>
                  </th>
                );
              })}
              {fields.map((field) => {
                return (
                  <th className="text-left" key={field}>
                    <div style={{ padding: '1px 2px' }}>
                      {
                        FIELDS.find((d) => {
                          return d.value == field;
                        }).label
                      }
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          {loading && (
            <tbody>
              <tr>
                <td colSpan={dimensions.length + fields.length}>
                  <div style={{ textAlign: 'center', padding: '20px 0px' }}>
                    <CSpinner animation="grow" color="secondary" />
                  </div>
                </td>
              </tr>
            </tbody>
          )}
          {!loading && stats && <DimensionRows dimensions={dimensions} fields={fields} stats={stats} />}
        </table>
      </div>
    </>
  );
};

const DimensionRows = ({ dimensions, fields, stats }) => {
  let rowsTds = DimensionsTds(dimensions, fields, stats);
  return (
    <tbody>
      {rowsTds.map((rowTds, rowIndex) => {
        return (
          <tr key={rowIndex}>
            {rowTds.map((td, index) => {
              return (
                <td style={DEFAULT_CELL_STYLE} key={index}>
                  {td}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
};

const DimensionsTds = (dimensions, fields, stats) => {
  let result = [];
  if (stats) {
    Object.keys(stats).map((dimension) => {
      if (dimensions.length <= 1) {
        result.push([dimension, ...FieldsTds(fields, stats[dimension])]);
      } else {
        let newDimensions = [...dimensions];
        newDimensions.shift();
        let rowsTds = DimensionsTds(newDimensions, fields, stats[dimension]);
        for (let rowTds of rowsTds) {
          result.push([dimension, ...rowTds]);
        }
      }
    });
  }
  return result;
};

const FieldsTds = (fields, stats) => {
  return fields.map((field) => FieldTd(field, stats));
};

const FieldTd = (field, stats) => {
  switch (field) {
    case 'count':
      return stats.count;

    case 'activated':
      return stats.activated.count;
    case 'activationRate':
      return formatFloat(stats.activated.activationRate * 100);
    case 'last_inscription_unique_click':
      return stats['last_inscription_stats']['unique_click'];
    case 'last_inscription_unique_open':
      return stats['last_inscription_stats']['unique_open'];
    case 'last_inscription_request':
      return stats['last_inscription_stats']['request'];
    case 'last_inscription_click_per_contact':
      return stats.count ? formatFloat(stats['last_inscription_stats']['unique_click'] / stats.count) : '';
    case 'unique_click':
    case 'unique_open':
    case 'request':
    case 'soft_bounce':
    case 'hard_bounce':
    case 'unsub':
      return stats['stats'][field];

    case 'click_rate':
      return stats['stats'].request ? formatFloat(calculatePercent(stats['stats'].unique_click ? stats['stats'].unique_click : 0, stats['stats'].request)) : '';

    case 'open_rate':
      return stats['stats'].request ? formatFloat(calculatePercent(stats['stats'].unique_open ? stats['stats'].unique_open : 0, stats['stats'].request)) : '';
    case 'click_per_contact':
      return stats.count ? formatFloat(stats['stats'].unique_click ? stats['stats'].unique_click / stats.count : 0) : '';

    case 'activityScore.avg':
      return formatFloat(stats['activityScore']['avg']);
    case 'activityScore.min':
      return formatFloat(stats['activityScore']['min']);
    case 'activityScore.max':
      return formatFloat(stats['activityScore']['max']);

    default:
      return '';
  }
};
