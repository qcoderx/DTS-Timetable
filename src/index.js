import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Imports your main component

// Mounts the app to the DOM
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);