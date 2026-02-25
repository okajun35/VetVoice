import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import App from './App';
// Design system CSS (imported in order: reset → global → design-system)
import './styles/reset.css';
import './styles/global.css';
import './styles/design-system.css';
import './index.css';

const amplifyOutputsModules = import.meta.glob('../amplify_outputs.json', { eager: true });
const outputs =
  '../amplify_outputs.json' in amplifyOutputsModules
    ? (amplifyOutputsModules['../amplify_outputs.json'] as { default: Record<string, unknown> })
        .default
    : {};

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
