import React from 'react';
import { Multiselect } from 'multiselect-react-dropdown';

export const InscriptionStatsFields = Object.freeze({
  uniqueInscriptions: 'uniqueInscriptions',
  uniqueActivations: 'uniqueActivations',
  uniqueActivation: 'uniqueActivation',
  inscriptions: 'inscriptions',
  news: 'news',
  activations: 'activations',
  newActivations: 'newActivations',
  newsRate: 'newsRate',
  activation: 'activation',
  newActivation: 'newActivation',

  requests: 'requests',
  uniqueClicks: 'uniqueClicks',
  uniqueClickRate: 'uniqueClickRate',
  requestsByInscription: 'requestsByInscription'
});

export const InscriptionStatsLabels = Object.freeze({
  [InscriptionStatsFields.uniqueInscriptions]: '# Unique Inscriptions',
  [InscriptionStatsFields.uniqueActivations]: '# Unique Activations',
  [InscriptionStatsFields.uniqueActivation]: '% Unique Activation',
  [InscriptionStatsFields.inscriptions]: '# Inscriptions',
  [InscriptionStatsFields.news]: '# News',
  [InscriptionStatsFields.activations]: '# Activations',
  [InscriptionStatsFields.newActivations]: '# New Activations',
  [InscriptionStatsFields.newsRate]: '% News',
  [InscriptionStatsFields.activation]: '% Activation',
  [InscriptionStatsFields.newActivation]: '% New Activation',

  [InscriptionStatsFields.requests]: '# Requests',
  [InscriptionStatsFields.uniqueClicks]: '# Unique Clicks',
  [InscriptionStatsFields.uniqueClickRate]: 'Unique Clicks by Inscriptions',
  [InscriptionStatsFields.requestsByInscription]: 'Requests by Inscriptions'
});

const InscriptionStatsOptions = [];

for (let field in InscriptionStatsFields) {
  InscriptionStatsOptions.push({
    id: field,
    label: InscriptionStatsLabels[field]
  });
}

export const InscriptionStatsFieldsSelector = ({ fields, setFields }) => {
  return (
    <Multiselect
      options={InscriptionStatsOptions} // Options to display in the dropdown
      style={{
        chips: { padding: '1px 4px', backgroundColor: '#3c4b64', color: '#FFF', marginBottom: '4px' },
        searchBox: { padding: '0px 2px', margin: '0px', input: { margin: '0px' } }
      }}
      selectedValues={InscriptionStatsOptions.filter((item) => {
        return fields.indexOf(item.id) >= 0;
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
