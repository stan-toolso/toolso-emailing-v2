import React from 'react';
import { Multiselect } from 'multiselect-react-dropdown';
import { IncomeFields } from './IncomeFields';
import { IncomeLabels } from './IncomeLabels';

const IncomeOptions = [];

for (let field in IncomeFields) {
  IncomeOptions.push({
    id: field,
    label: IncomeLabels[field]
  });
}

export const IncomeFieldsSelector = ({ fields, setFields }) => {
  return (
    <Multiselect
      options={IncomeOptions} // Options to display in the dropdown
      style={{
        chips: { padding: '1px 4px', backgroundColor: '#3c4b64', color: '#FFF', marginBottom: '4px' },
        searchBox: { padding: '0px 2px', margin: '0px', input: { margin: '0px' } },
        width: '100%'
      }}
      selectedValues={IncomeOptions.filter((item) => {
        return fields.indexOf(item.id) >= 0;
      }).sort((a, b) => {
        return fields.indexOf(a.id) < fields.indexOf(b.id) ? -1 : 1;
      })}
      onSelect={(selectedList, selectedItem) => {
        setFields([...fields, selectedItem.id]);
      }}
      onRemove={(selectedList, removedItem) => {
        setFields([...fields.filter((item) => removedItem.id !== item)]);
      }}
      displayValue="label" // Property name to display in the dropdown options
    />
  );
};
