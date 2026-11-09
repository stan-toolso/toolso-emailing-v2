import React, { useState, useEffect } from 'react';
import { CButton, CCol, CInput, CRow, CTooltip, CSpinner } from '@coreui/react';
import { toast } from 'react-toastify';
import EspSelector from '../../common/EspSelector';

function getAvailableParamsForStrategy() {
  return ['acceptableComplaintScoreThresold', 'malusForThreshold', 'malusMultiplier'];
}

export default ({ strats, loading, refetch, updateSettings, toastSuccess }) => {
  const [saving, setSaving] = useState(false);

  const [showLineCreation, setShowLineCreation] = useState(false);

  const [newSegmentFrom, setNewSegmentFrom] = useState(51);
  const [newSegmentTo, setNewSegmentTo] = useState(100);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newName, setNewName] = useState('');
  const [newParams, setNewParams] = useState({ acceptableComplaintScoreThresold: 50, malusForThreshold: 2, malusMultiplier: 10 });
  const [newEsps, setNewEsps] = useState(['']);

  const [lineToEdit, setLineToEdit] = useState(-1);
  const [currentStrat, setCurrentStrat] = useState(null);
  const [editSegmentFrom, setEditSegmentFrom] = useState(-1);
  const [editSegmentTo, setEditSegmentTo] = useState(-1);
  const [editSegmentName, setEditSegmentName] = useState('');
  const [editName, setEditName] = useState('');
  const [editParams, setEditParams] = useState({});
  const [editEsps, setEditEsps] = useState(['']);

  useEffect(() => {
    if (lineToEdit >= 0) {
      setCurrentStrat({ ...strats[lineToEdit] });
    }
  }, [lineToEdit, setLineToEdit, strats, setCurrentStrat]);

  useEffect(() => {
    if (currentStrat) {
      setEditSegmentFrom(currentStrat.segment?.from);
      setEditSegmentTo(currentStrat.segment?.to);
      setEditSegmentName(currentStrat.segment?.name);
      setEditName(currentStrat.name);
      setEditParams(getParams(currentStrat));
      setEditEsps(currentStrat.esps);
    }
  }, [currentStrat, setEditSegmentFrom, setEditSegmentTo, setEditName, setEditParams, setEditEsps]);

  function getParams(strat) {
    let result = {};
    getAvailableParamsForStrategy().map((param) => {
      result[param] = strat[param];
    });
    return result;
  }

  function deleteStrat(strat) {
    const index = strats.indexOf(strat);
    strats.splice(index, 1);
  }

  function setParamForNewLine(paramName, paramValue) {
    let copyNewParams = { ...newParams };
    copyNewParams[paramName] = paramValue;
    setNewParams(copyNewParams);
  }

  function setParamForEditLine(paramName, paramValue) {
    let copyEditParams = { ...editParams };
    copyEditParams[paramName] = paramValue;

    strats[lineToEdit][paramName] = paramValue;
    setEditParams(copyEditParams);
  }

  function getEditModeRow(index) {
    return (
      <tr key={index + '_edit'} onBlur={() => validateChangeIfPossible(index)}>
        <td className="align-middle" style={{ padding: '5px', maxWidth: '60px' }}>
          <CInput
            type="number"
            id="segmentFrom"
            placeholder="Segment From"
            required
            value={editSegmentFrom}
            onChange={(event) => {
              strats[lineToEdit].segment.from = event.target.value;
              setEditSegmentFrom(event.target.value);
            }}
          ></CInput>
        </td>
        <td className="align-middle" style={{ padding: '5px', maxWidth: '60px' }}>
          <CInput
            type="number"
            id="segmentTo"
            placeholder="Segment To"
            required
            value={editSegmentTo}
            onChange={(event) => {
              strats[lineToEdit].segment.to = event.target.value;
              setEditSegmentTo(event.target.value);
            }}
          ></CInput>
        </td>
        <td className="align-middle" style={{ padding: '5px', maxWidth: '60px' }}>
          <CInput
            type="text"
            id="segmentName"
            placeholder="Segment Name"
            required
            value={editSegmentName}
            onChange={(event) => {
              if (event.target.value) {
                strats[lineToEdit].segment.name = event.target.value;
              } else {
                delete strats[lineToEdit].segment.name;
              }

              setEditSegmentName(event.target.value);
            }}
          ></CInput>
        </td>
        <td className="align-middle" style={{ padding: '5px', minWidth: '200px' }}>
          <EspSelector style={{ width: '100%' }} esps={editEsps} setEsps={setEditEsps} />
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CInput
            type="text"
            id="Name"
            placeholder="Name"
            required
            value={editName}
            onChange={(event) => {
              strats[lineToEdit].name = event.target.value;
              setEditName(event.target.value);
            }}
          ></CInput>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <table className="text-center" style={{ textAlign: 'center', width: '100%' }}>
            <tbody>
              {getAvailableParamsForStrategy().map((param, index) => {
                return (
                  <tr key={index}>
                    <td className="align-middle" style={{ padding: '5px' }}>
                      {param}
                    </td>
                    <td style={{ padding: '5px' }}>
                      <CInput
                        size="3xl"
                        type="text"
                        id={param}
                        placeholder={param}
                        value={(editParams && editParams[param]) ?? ''}
                        className="float-right"
                        onChange={(event) => {
                          setParamForEditLine(param, event.target.value);
                        }}
                      ></CInput>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </td>
        <td className="align-middle" style={{ padding: '5px', width: '80px' }}>
          <CButton
            size="sm"
            color="danger"
            className="ml-1 mr-1"
            onClick={async () => {
              setLineToEdit(-1);
            }}
          >
            Cancel
          </CButton>
        </td>
      </tr>
    );

    function validateChangeIfPossible() {
      var currentStrat = getMarketingPressureStrategy(editSegmentFrom, editSegmentTo, editParams, editName, editEsps, editSegmentName);
      if (currentStrat) {
        setLineToEdit(-1);
      }
    }
  }

  function getReadOnlyModeRow(strat, index) {
    return (
      <tr
        key={index}
        onClick={async () => {
          setLineToEdit(index);
        }}
      >
        <td className="align-middle" style={{ padding: '5px', maxWidth: '60px' }}>
          {strat.segment?.from}
        </td>
        <td className="align-middle" style={{ padding: '5px', maxWidth: '60px' }}>
          {strat.segment?.to}
        </td>
        <td className="align-middle" style={{ padding: '5px', maxWidth: '60px' }}>
          {strat.segment?.name}
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          {strat.esps && strat.esps.join(', ')}
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          {strat.name}
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          {getAvailableParamsForStrategy()
            .map((param) => param + ' : ' + strat[param])
            .join(', ')}
        </td>
        <td className="align-middle" style={{ padding: '5px', width: '80px' }}>
          <CButton
            size="sm"
            color="danger"
            className="ml-1 mr-1"
            onClick={async () => {
              deleteStrat(strat);
            }}
          >
            Delete
          </CButton>
        </td>
      </tr>
    );
  }

  function getNewRow() {
    return (
      <tr>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CTooltip content="an integer representing the begin of the segment between 1 and 100">
            <CInput
              type="number"
              id="name"
              placeholder="Segment From"
              required
              value={newSegmentFrom}
              onChange={(event) => {
                setNewSegmentFrom(event.target.value);
              }}
            ></CInput>
          </CTooltip>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CTooltip content="an integer representing the end of the segment between 1 and 100">
            <CInput
              type="number"
              id="name"
              placeholder="Segment To"
              required
              min="1"
              max="100"
              value={newSegmentTo}
              onChange={(event) => {
                setNewSegmentTo(event.target.value);
              }}
            ></CInput>
          </CTooltip>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CTooltip content="optional : id of the segment">
            <CInput
              type="text"
              id="segmentName"
              placeholder="Segment Name"
              required
              min="1"
              max="100"
              value={newSegmentName}
              onChange={(event) => {
                setNewSegmentName(event.target.value);
              }}
            ></CInput>
          </CTooltip>
        </td>
        <td className="align-middle" style={{ padding: '5px', minWidth: '200px' }}>
          <EspSelector style={{ width: '100%' }} esps={newEsps} setEsps={setNewEsps} />
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CTooltip content="choose a label for this strat and this params">
            <CInput
              type="text"
              id="strategyName"
              placeholder="Strategy Name"
              required
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
              }}
            ></CInput>
          </CTooltip>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <table className="text-center" style={{ textAlign: 'center', width: '100%' }}>
            <tbody>
              {getAvailableParamsForStrategy().map((param) => {
                return (
                  <tr key={param}>
                    <td className="align-middle" style={{ padding: '5px' }}>
                      {param}
                    </td>
                    <td style={{ padding: '5px' }}>
                      <CInput
                        size="3xl"
                        type="text"
                        id={param}
                        placeholder={param}
                        value={newParams[param]}
                        className="float-right"
                        onChange={(event) => {
                          setParamForNewLine(param, event.target.value);
                        }}
                      ></CInput>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CButton
            size="sm"
            color="danger"
            className="ml-1"
            onClick={async () => {
              setShowLineCreation(false);
            }}
          >
            Cancel
          </CButton>
        </td>
      </tr>
    );
  }

  let index = 0;
  return (
    <>
      <CRow>
        <div className="table-responsive" style={{ padding: '20px', textAlign: 'center' }}>
          {loading && <CSpinner />}
          {!loading && (
            <table className="table table-sm m-0 stats-table table-bordered">
              <thead>
                <tr>
                  <th style={{ padding: '5px' }} key="segmentFrom">
                    Segment from
                  </th>
                  <th style={{ padding: '5px' }} key="segmentTo">
                    Segment to
                  </th>
                  <th style={{ padding: '5px' }} key="segmentName">
                    Segment name
                  </th>
                  <th style={{ padding: '5px', minWidth: '200px' }} key="esps">
                    Esps
                  </th>
                  <th style={{ padding: '5px' }} key="strategyName">
                    Strategy Name
                  </th>
                  <th style={{ padding: '5px' }} key="strategyParams">
                    Strategy Params
                  </th>
                  <th style={{ padding: '5px' }} key="actions" />
                </tr>
              </thead>
              <tbody>
                {strats &&
                  !loading &&
                  strats.map((strat) => {
                    if (index === lineToEdit) {
                      return getEditModeRow(index++);
                    } else {
                      return getReadOnlyModeRow(strat, index++);
                    }
                  })}
                {showLineCreation && getNewRow()}
              </tbody>
              {!showLineCreation && (
                <tfoot>
                  <tr>
                    <td className="align-middle" style={{ padding: '5px' }} colSpan="8">
                      <CButton
                        size="sm"
                        color="primary"
                        className="float-left"
                        onClick={() => {
                          setShowLineCreation(true);
                        }}
                      >
                        Create Marketing Pressure Strategy
                      </CButton>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </CRow>
      {!loading && (
        <CRow>
          <CCol xl={12}>
            <CButton
              color="primary"
              onClick={async () => {
                setSaving(true);

                let needToStopSaving = false;
                if (showLineCreation) {
                  var newStrat = getMarketingPressureStrategy(newSegmentFrom, newSegmentTo, newParams, newName, newEsps, newSegmentName);
                  if (!newStrat) {
                    needToStopSaving = true;
                  } else {
                    strats.push(newStrat);
                  }
                }
                if (!needToStopSaving) {
                  await updateSettings({
                    variables: {
                      settings: { marketingPressureStrategies: strats }
                    }
                  });
                  refetch();
                  setShowLineCreation(false);
                  setLineToEdit();
                }
                setSaving(false);
                toastSuccess('Complaint Reduction Policy Strategies are saved');
              }}
            >
              {saving && <CSpinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" color="secondary" />}
              Save
            </CButton>
          </CCol>
        </CRow>
      )}
    </>
  );
};
function toastError(message) {
  toast.error(message, {
    position: toast.POSITION.BOTTOM_RIGHT
  });
}

function getMarketingPressureStrategy(segmentFrom, segmentTo, params, name, esps, segmentName) {
  if (!segmentFrom || segmentFrom > 100) {
    toastError('invalid Segment From');
    return null;
  }

  if (!segmentTo || segmentTo > 100) {
    toastError('invalid Segment To');
    return null;
  }

  if (parseInt(segmentTo) < parseInt(segmentFrom)) {
    toastError('From has to be less than to');
    return null;
  }

  if (!name) {
    toastError('Name is mandatory for pressure Strategies');
    return null;
  }

  var strat = {};
  strat.segment = {
    from: segmentFrom,
    to: segmentTo
  };
  if (segmentName) {
    strat.segment.name = segmentName;
  }

  if (params) {
    getAvailableParamsForStrategy().map((param) => {
      strat[param] = params[param];
    });
  }
  if (name) {
    strat.name = name;
  }
  if (esps && esps.length > 0) {
    let filteredEsps = esps.filter((esp) => esp !== '');
    if (filteredEsps.length > 0) {
      strat.esps = filteredEsps;
    }
  }
  strat.type = 'complaint_reduction_policy';
  return strat;
}
