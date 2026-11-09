import React from 'react';
import { Multiselect } from 'multiselect-react-dropdown';
import { ActivationFields } from './ActivationFields';
import { ActivationLabels } from './ActivationLabels';

const Options = [];

for (let field in ActivationFields) {
  if (!(field in ActivationLabels)) continue;
  Options.push({
    id: field,
    label: ActivationLabels[field]
  });
}

export const ActivationFieldsSelector = ({ fields, setFields }) => {
  return (
    <Multiselect
      options={Options} // Options to display in the dropdown
      style={{
        chips: { padding: '1px 4px', backgroundColor: '#3c4b64', color: '#FFF', marginBottom: '4px' },
        searchBox: { padding: '0px 2px', margin: '0px', input: { margin: '0px' } },
        width: '100%'
      }}
      selectedValues={Options.filter((item) => {
        return fields.indexOf(item.id) >= 0;
      }).sort((a, b) => {
        return fields.indexOf(a.id) < fields.indexOf(b.id) ? -1 : 1;
      })}
      onSelect={(_selectedList, selectedItem) => {
        setFields([...fields, selectedItem.id]);
      }}
      onRemove={(_selectedList, removedItem) => {
        setFields([...fields.filter((item) => removedItem.id !== item)]);
      }}
      displayValue="label" // Property name to display in the dropdown options
    />
  );
};
