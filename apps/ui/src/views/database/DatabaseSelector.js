import React from 'react';
import { Multiselect } from 'multiselect-react-dropdown';
import { useSelector } from 'react-redux';

export const DatabaseSelector = ({ databases, setDatabases }) => {
  const emailingDatabases = useSelector((state) => state.emailingDatabases);

  const options = emailingDatabases.map((database) => {
    return {
      id: database.uid,
      label: database.name
    };
  });
  return (
    <Multiselect
      options={options} // Options to display in the dropdown
      style={{
        chips: { padding: '1px 4px', backgroundColor: '#3c4b64', color: '#FFF', marginBottom: '4px' },
        searchBox: { padding: '0px 2px', margin: '0px', input: { margin: '0px' } },
        width: '100%'
      }}
      selectedValues={options
        .filter((item) => {
          return databases.indexOf(item.id) >= 0;
        })
        .sort((a, b) => {
          return databases.indexOf(a.id) < databases.indexOf(b.id) ? -1 : 1;
        })}
      onSelect={(selectedList, selectedItem) => {
        setDatabases([...databases, selectedItem.id]);
      }}
      onRemove={(selectedList, removedItem) => {
        setDatabases([...databases.filter((item) => removedItem.id !== item)]);
      }}
      displayValue="label" // Property name to display in the dropdown options
    />
  );
};
