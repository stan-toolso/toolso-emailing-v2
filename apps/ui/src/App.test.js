import React from 'react';
import { render } from '@testing-library/react';
import App from './App';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { HashRouter } from 'react-router-dom';

// smoke test - test if it render
test('it should render', () => {
  const initialState = { output: 10 };
  const mockStore = configureStore();
  let store = mockStore(initialState);
  const { container } = render(
    <Provider store={store}>
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
  );
  const linkElement = container.getElementsByClassName('Toastify');
  expect(linkElement).toBeTruthy();
});
