import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

export const useSettings = (name) => {
  const [settings, setSettings] = useState(null);

  const { data } = useQuery(
    gql`
      query getSettings($names: [String]!) {
        getSettings(names: $names)
      }
    `,
    {
      variables: {
        names: [name]
      }
    }
  );

  useEffect(() => {
    if (data) {
      setSettings(data.getSettings[name]);
    }
  }, [data, setSettings, name]);

  return [settings];
};

export const useMultipleSettings = (names) => {
  const [settings, setSettings] = useState(null);

  const { data } = useQuery(
    gql`
      query getSettings($names: [String]!) {
        getSettings(names: $names)
      }
    `,
    {
      variables: {
        names
      }
    }
  );

  useEffect(() => {
    if (data) {
      setSettings(data.getSettings);
    }
  }, [data, setSettings, names]);

  return settings;
};
