import React, { useContext, useState, useEffect } from 'react';
import { CButton, CCol, CInput, CSelect, CRow, CTooltip, CSpinner } from '@coreui/react';
import { updateSchedule } from './utils';
import EmailingDatabaseApiContext from '../../../../contexts/EmailingDatabaseApiContext';
import { toast } from 'react-toastify';
import EspSelector from '../../../common/EspSelector';

function getAvailableParamsForStrategy() {
  //TODO: use strategype to use strategy dependant parameters
  return ['powFactor', 'dateReceptionPenaltyPowFactor', 'timesReceptionPenaltyMultipicator', 'useOnlyEspStats', 'noClickOptimisationBeforeActivation', 'onlyReferenceContactsForComplaintsAndUnsubs'];
}

function getParams(strategyType, strategyParams) {
  var res = {};
  var params = getAvailableParamsForStrategy(strategyType);
  if (params) {
    params.map((param) => {
      if (strategyParams && strategyParams[param]) {
        res[param] = strategyParams[param];
      }
      return param;
    });
  }
  return res;
}

export default ({ schedule, forceUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [strats, setStrats] = useState(schedule.config && schedule.config.contentStrategies);
  const emailingDatabaseApiContext = useContext(EmailingDatabaseApiContext);
  const [showLineCreation, setShowLineCreation] = useState(false);

  const [newSegmentFrom, setNewSegmentFrom] = useState(51);
  const [newSegmentTo, setNewSegmentTo] = useState(100);
  const [newName, setNewName] = useState('');
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newType, setNewType] = useState('qualityScore');
  const [newParams, setNewParams] = useState({});
  const [newEsps, setNewEsps] = useState(['']);

  const [lineToEdit, setLineToEdit] = useState(-1);
  const [currentStrat, setCurrentStrat] = useState(null);
  const [editSegmentFrom, setEditSegmentFrom] = useState(-1);
  const [editSegmentTo, setEditSegmentTo] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editSegmentName, setEditSegmentName] = useState('');
  const [editType, setEditType] = useState('');
  const [editParams, setEditParams] = useState({});
  const [editEsps, setEditEsps] = useState(['']);

  const canEdit = schedule.type === 'recurrent' || schedule.type === 'inscription';

  useEffect(() => {
    if (lineToEdit >= 0) {
      setCurrentStrat(strats[lineToEdit]);
    }
  }, [lineToEdit, setLineToEdit, strats, setCurrentStrat]);

  useEffect(() => {
    if (currentStrat) {
      setEditSegmentFrom(currentStrat.segment?.from);
      setEditSegmentTo(currentStrat.segment?.to);
      setEditType(currentStrat.type);
      setEditName(currentStrat.name);
      setEditSegmentName(currentStrat.segment?.name);
      setEditParams(currentStrat.params);
      setEditEsps(currentStrat.esps);
    }
  }, [currentStrat, setEditSegmentFrom, setEditSegmentTo, setEditType, setEditName, setEditParams, setEditEsps]);

  function deleteStratFromSchedule(schedule, strat) {
    if (schedule.config && schedule.config.contentStrategies) {
      schedule.config.contentStrategies = schedule.config.contentStrategies.filter(
        (strategy) => !(strategy.type === strat.type && strategy.name === strat.name && strategy.segment.from === strat.segment.from && strategy.segment.to === strat.segment.to)
      );
    }
  }

  function setParamForNewLine(paramName, paramValue) {
    let copyNewParams = { ...newParams };
    copyNewParams[paramName] = paramValue;
    setNewParams(copyNewParams);
  }

  function setParamForEditLine(paramName, paramValue) {
    let copyEditParams = { ...editParams };
    copyEditParams[paramName] = paramValue;
    setEditParams(copyEditParams);
  }

  function getAvailableTypes() {
    return (
      <>
        <option value="qualityScore" id="qualityScore">
          QualityScore
        </option>
        <option value="bestOpenAndClick" id="bestOpenAndClick">
          BestOpenAndClick
        </option>
        <option value="bestClick" id="bestClick">
          BestClick
        </option>
        <option value="bestOpen" id="bestOpen">
          BestOpen
        </option>
        <option value="recommendation" id="recommendation">
          Recommendation
        </option>
        <option value="contentScore" id="contentScore">
          Content Score
        </option>
        <option value="qualityScoreByEsp" id="qualityScoreByEsp">
          QualityScore By Esp
        </option>
        <option value="eCpmScore" id="eCpmScore">
          ECpm
        </option>
        <option value="unsubScore" id="unsubScore">
          Unsub Score
        </option>
      </>
    );
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
              setEditSegmentName(event.target.value);
            }}
          ></CInput>
        </td>
        <td className="align-middle" style={{ padding: '5px', minWidth: '200px' }}>
          <EspSelector style={{ width: '100%' }} esps={editEsps} setEsps={setEditEsps} />
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CSelect
            style={{ display: 'inline-block' }}
            className="form-control mr-2"
            id="editType"
            placeholder="Type"
            size="sm"
            onChange={(event) => {
              setEditType(event.target.value);
            }}
            value={editType}
          >
            {getAvailableTypes()}
          </CSelect>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <CInput
            type="text"
            id="Name"
            placeholder="Name"
            required
            value={editName}
            onChange={(event) => {
              setEditName(event.target.value);
            }}
          ></CInput>
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          <table className="text-center" style={{ textAlign: 'center', width: '100%' }}>
            <tbody>
              {availableParamsForEditStrategy.map((param, index) => {
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

    function validateChangeIfPossible(index) {
      var currentStrat = getContentStrategy(editSegmentFrom, editSegmentTo, editType, editParams, editName, editEsps, editSegmentName);
      if (currentStrat) {
        schedule.config.contentStrategies[index] = currentStrat;
        setStrats(schedule.config.contentStrategies);
        setLineToEdit(-1);
      }
    }
  }

  function getReadOnlyModeRow(strat, params, index) {
    return (
      <tr
        key={index}
        onClick={async () => {
          if (canEdit) {
            setLineToEdit(index);
          }
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
          {strat.type}
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          {strat.name}
        </td>
        <td className="align-middle" style={{ padding: '5px' }}>
          {Object.keys(params).map((param) => {
            return (
              <div key={param}>
                {param}={params[param]}
                <br />
              </div>
            );
          })}
        </td>
        <td className="align-middle" style={{ padding: '5px', width: '80px' }}>
          <CButton
            size="sm"
            color="danger"
            className="ml-1 mr-1"
            onClick={async () => {
              deleteStratFromSchedule(schedule, strat);
              setStrats(schedule.config.contentStrategies);
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
          <CTooltip content="optional : specific segment name">
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
          <CTooltip content="the type of the strategy for example qualityScore">
            <CSelect
              style={{ display: 'inline-block' }}
              className="form-control mr-2"
              size="sm"
              onChange={(event) => {
                setNewType(event.target.value);
              }}
              value={newType}
            >
              {getAvailableTypes()}
            </CSelect>
          </CTooltip>
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
              {availableParamsForNewStrategy.map((param) => {
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

  var availableParamsForNewStrategy = getAvailableParamsForStrategy(newType);
  var availableParamsForEditStrategy = getAvailableParamsForStrategy(editType);
  let index = 0;
  return (
    <>
      <CRow>
        <div className="table-responsive" style={{ padding: '20px', textAlign: 'center' }}>
          <table className="table table-sm m-0 stats-table table-bordered">
            <thead>
              <tr>
                <th style={{ padding: '5px' }} key="segmentFrom">
                  Segment from
                </th>
                <th style={{ padding: '5px' }} key="segmentTo">
                  Segment to
                </th>
                <th style={{ padding: '5px' }} key="segmentTo">
                  Segment Name
                </th>
                <th style={{ padding: '5px', minWidth: '200px' }} key="esps">
                  Esps
                </th>
                <th style={{ padding: '5px' }} key="strategyType">
                  Strategy Type
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
                strats.map((strat) => {
                  var params = getParams(strat.type, strat.params);
                  if (index === lineToEdit) {
                    return getEditModeRow(index++);
                  } else {
                    return getReadOnlyModeRow(strat, params, index++);
                  }
                })}
              {showLineCreation && getNewRow()}
            </tbody>
            {!showLineCreation && canEdit && (
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
                      Create Strategy
                    </CButton>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CRow>
      <CRow>
        <CCol xl={12}>
          <div style={{ paddingBottom: '20px' }}>
            N.B. Contacts not in segments or esps listed below do have default Sending strategy
            <br />
          </div>
        </CCol>
      </CRow>
      {canEdit && (
        <CRow>
          <CCol xl={12}>
            <CButton
              color="primary"
              onClick={async () => {
                setSaving(true);

                let needToStopSaving = false;
                if (showLineCreation) {
                  var newStrat = getContentStrategy(newSegmentFrom, newSegmentTo, newType, newParams, newName, newEsps, newSegmentName);
                  if (!newStrat) {
                    needToStopSaving = true;
                  } else {
                    if (!schedule.config.contentStrategies) {
                      schedule.config.contentStrategies = [];
                    }
                    schedule.config.contentStrategies.push(newStrat);
                  }
                }
                let config = schedule.config ?? {};
                if (!needToStopSaving) {
                  await updateSchedule(
                    emailingDatabaseApiContext,
                    schedule,
                    {
                      name: schedule.name,
                      config,
                      scheduleDate: schedule.scheduleDate,
                      sendingConfigId: schedule.sendingConfig.id
                    },
                    `Schedule has been saved`,
                    forceUpdate
                  );
                  setStrats(schedule.config.contentStrategies);
                  setShowLineCreation(false);
                  setLineToEdit();
                }

                setSaving(false);
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

function getContentStrategy(segmentFrom, segmentTo, type, params, name, esps, segmentName) {
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

  var strat = {};
  strat.segment = {
    from: segmentFrom,
    to: segmentTo
  };
  if (segmentName) {
    strat.segment.name = segmentName;
  }

  strat.type = type;
  strat.params = params;
  if (name) {
    strat.name = name;
  }
  if (esps && esps.length > 0) {
    let filteredEsps = esps.filter((esp) => esp !== '');
    if (filteredEsps.length > 0) {
      strat.esps = filteredEsps;
    }
  }
  return strat;
}
