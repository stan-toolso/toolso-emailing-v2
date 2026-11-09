import React from 'react';
import { CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle } from '@coreui/react';
import { DIMENSIONS } from './DelivStats';

export const SubdimensionSelector = ({ subDimensionType, setSubDimensionType, filter, dimensions }) => {
  let availableDimensions = dimensions ?? DIMENSIONS;
  return (
    <div style={{ float: 'right', paddingRight: '0px', width: subDimensionType ? '100px' : '17px', position: 'relative', textAlign: 'right' }}>
      <CDropdown>
        <CDropdownToggle
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0px 0px 0px 0px',
            fontSize: '12px'
          }}
        >
          {subDimensionType && <strong>{availableDimensions[subDimensionType].label}</strong>}
          {!subDimensionType && <span>&nbsp;&nbsp;</span>}
        </CDropdownToggle>
        <CDropdownMenu placement="bottom-end" className="py-0">
          {subDimensionType && (
            <CDropdownItem
              style={{
                cursor: 'pointer',
                height: '23px',
                padding: '2px 5px',
                border: '0px'
              }}
              onClick={() => {
                setSubDimensionType(null);
              }}
            >
              <div className="w-100" style={{ textAlign: 'right' }}>
                &nbsp;&nbsp;&nbsp;&nbsp;
              </div>
            </CDropdownItem>
          )}
          {Object.values(availableDimensions).map((dimension, index) => {
            if (filter && dimension.value in filter) {
              return null;
            }
            return (
              <CDropdownItem
                style={{
                  cursor: 'pointer',
                  height: '23px',
                  padding: '2px 5px',
                  border: '0px'
                }}
                key={index}
                onClick={() => {
                  setSubDimensionType(dimension.value);
                }}
              >
                <div className="w-100" style={{ textAlign: 'right' }}>
                  {dimension.label}
                </div>
              </CDropdownItem>
            );
          })}
        </CDropdownMenu>
      </CDropdown>
    </div>
  );
};
