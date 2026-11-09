import React, { useCallback } from 'react';
import { CCol, CInput, CPagination, CRow, CSelect } from '@coreui/react';
import { formatInteger } from '../util';
const DEFAULT_LIMITS = [1, 10, 50, 100, 200, 500];

export default ({ offset, limit, total, setOffset, setLimit, limits, showSelectPageSection }) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const pages = Math.floor(total > 0 && limit > 0 ? (total - 1) / limit : 0) + 1;

  if (!limits) {
    limits = DEFAULT_LIMITS;
  }

  const pageChange = useCallback(
    (page) => {
      page = Math.min(pages, page);
      page = Math.max(1, page);
      let newOffset = (page - 1) * limit;
      setOffset(newOffset);
    },
    [setOffset, pages, limit]
  );
  if (total === 0) {
    return null;
  }
  return (
    <CRow>
      {showSelectPageSection && (
        <CCol md={4}>
          {pages > 1 && (
            <div className="d-flex justify-content-start">
              <div className="d-inline-block ml-2">
                <span>Go to </span>
                <CInput
                  size="sm"
                  type="number"
                  style={{ width: '80px' }}
                  className="d-inline-block mx-2"
                  value={currentPage}
                  onChange={(event) => {
                    pageChange(parseInt(event.target.value));
                  }}
                />
                <span> Of {pages}</span>
              </div>
            </div>
          )}
        </CCol>
      )}
      <CCol md={showSelectPageSection ? 8 : 12}>
        <div className="d-flex justify-content-end">
          {total >= 1 && setLimit && (
            <div className="d-inline-block ml-2">
              <span>Show</span>
              <CSelect
                size="sm"
                style={{ width: '80px' }}
                className="d-inline-block ml-2"
                value={limit}
                onChange={(event) => {
                  setLimit(parseInt(event.target.value));
                }}
              >
                {limits.map((item, index) => {
                  return (
                    <option value={item} key={index}>
                      {item}
                    </option>
                  );
                })}
              </CSelect>
            </div>
          )}
          <div className="d-inline-block ml-2 pt-1">
            <span>
              {offset + 1}-{Math.min(total, offset + limit)} of {formatInteger(total)}
            </span>
          </div>
          {pages > 1 && <CPagination size="sm" activePage={currentPage} onActivePageChange={pageChange} pages={pages} doubleArrows={pages > 10} className="d-inline-block ml-2" />}
        </div>
      </CCol>
    </CRow>
  );
};
