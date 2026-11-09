import React from 'react';
import { formatInteger } from '../../util';
import { CSpinner } from '@coreui/react';
import { CChartPie } from '@coreui/react-chartjs';

export const delivRouterStatsFields = {
  type: 'type',
  request: 'request',
  total: 'total',
  toolso: 'toolso',
  sib: 'sib',
  aws_ses: 'aws_ses',
  newsletter: 'newsletter',
  marketing: 'marketing',
  welcome_mail: 'welcome_mail'
};

const LABELS = {
  [delivRouterStatsFields.type]: 'Type',
  [delivRouterStatsFields.router]: 'Router',
  [delivRouterStatsFields.request]: 'Request',
  [delivRouterStatsFields.total]: 'Total',
  [delivRouterStatsFields.toolso]: 'Toolso',
  [delivRouterStatsFields.sib]: 'Sendinblue',
  [delivRouterStatsFields.aws_ses]: 'Amazon SES',
  [delivRouterStatsFields.newsletter]: 'Newsletter',
  [delivRouterStatsFields.marketing]: 'Marketing',
  [delivRouterStatsFields.welcome_mail]: 'Welcome Mail'
};

const PIE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  tooltips: {
    enabled: true
  },
  legend: {
    position: 'bottom'
  },
  title: {
    display: true
  }
};

const PIE_COLORS = ['#41B883', '#E46651', '#00D8FF', '#DD1B16'];

export const RoutersStatsTable = ({ loading, stats }) => {
  var routers = stats && [...new Set(stats.map((item) => item.router))];

  var columns = ['type', ...routers, 'total'];
  var types = stats && [...new Set(stats.map((item) => item.type))];
  var lines = [...types, 'total'];

  var routersLabels = stats && routers.map((router) => LABELS[router]);
  let routerRepartitionDatasets = getRouterRepartitionDataset(stats, routers);

  var typesLabel = stats && types.map((type) => LABELS[type]);
  let typeRepartitionDatasets = getTypeRepartitionDataset(stats, types);

  return (
    <>
      <table className="table table-sm">
        <thead>
          <tr className="font-weight-bold">
            {columns.map((field, index) => {
              if (field in LABELS) {
                return <th key={index}>{LABELS[field]}</th>;
              } else {
                return <th key={index}>{field}</th>;
              }
            })}
          </tr>
        </thead>
        {loading && (
          <tbody>
            <tr>
              <td colSpan={columns.length}>
                <div style={{ textAlign: 'center', padding: '30px 0px' }}>
                  <CSpinner animation="grow" color="secondary" />
                </div>
              </td>
            </tr>
          </tbody>
        )}
        {!loading && columns && lines && stats && <tbody>{lines && lines.map((lineLabel) => getLine(lineLabel, columns, stats))}</tbody>}
      </table>
      {!loading && (
        <table className="table table-sm">
          <tbody>
            <tr>
              <td>
                <CChartPie type="pie" datasets={routerRepartitionDatasets} labels={routersLabels} options={getPieOptions('Repartition by Router')} style={{ height: '250px', maxWidth: '500px' }} />
              </td>
              <td>
                <CChartPie type="pie" datasets={typeRepartitionDatasets} labels={typesLabel} options={getPieOptions('Repartition by Type')} style={{ height: '250px', maxWidth: '500px' }} />
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  );
};

const getPieOptions = (title) => {
  return { ...PIE_OPTIONS, title: { text: title, display: true } };
};

const getLine = (lineLabel, columns, stats) => {
  return (
    <tr key={lineLabel} className={lineLabel === delivRouterStatsFields.total ? 'font-weight-bold' : ''}>
      {columns.map((field) => {
        return (
          <td key={field}>
            <DelivRoutersStatsTd lineLabel={lineLabel} field={field} lineStat={getRouterLineStat(lineLabel, stats)} />
          </td>
        );
      })}
    </tr>
  );
};

const getRouterLineStat = (lineLabel, stats) => {
  var result = stats;
  if (lineLabel !== delivRouterStatsFields.total) {
    result = result.filter((line) => line.type === lineLabel);
  }
  return result;
};

const getRouterColumnStat = (field, lineStat) => {
  var result = lineStat;
  if (field !== delivRouterStatsFields.total) {
    result = result.filter((line) => line.router === field);
  }
  result = result.reduce((a, b) => a + parseInt(b.request), 0);
  return formatInteger(result);
};

const DelivRoutersStatsTd = ({ field, lineStat, lineLabel }) => {
  switch (field) {
    case delivRouterStatsFields.type:
      if (lineLabel in LABELS) {
        return <span>{LABELS[lineLabel]}</span>;
      } else {
        return <span>{lineLabel}</span>;
      }

    case delivRouterStatsFields.total:
      return <span className="font-weight-bold">{getRouterColumnStat(field, lineStat)}</span>;
    default:
      return <span>{getRouterColumnStat(field, lineStat)}</span>;
  }
};

function getDefaultDataSet() {
  return [
    {
      backgroundColor: PIE_COLORS,
      data: []
    }
  ];
}

function getRouterRepartitionDataset(stats, routers) {
  let routerRepartitionDatasets = getDefaultDataSet();

  if (stats) {
    routers.forEach((element) => {
      var lineStat = stats.filter((line) => line.router === element);
      var count = lineStat.reduce((a, b) => a + parseInt(b.request), 0);
      routerRepartitionDatasets[0].data.push(count);
    });
  }
  return routerRepartitionDatasets;
}

function getTypeRepartitionDataset(stats, types) {
  let typeRepartitionDatasets = getDefaultDataSet();

  if (stats) {
    types.forEach((element) => {
      var lineStat = stats.filter((line) => line.type === element);
      var count = lineStat.reduce((a, b) => a + parseInt(b.request), 0);
      typeRepartitionDatasets[0].data.push(count);
    });
  }
  return typeRepartitionDatasets;
}
