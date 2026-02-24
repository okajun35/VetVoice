import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
// Design system CSS (imported in order: reset → global → design-system)
import './styles/reset.css';
import './styles/global.css';
import './styles/design-system.css';
import './index.css';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
