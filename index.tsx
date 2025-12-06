import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ReceiptsProvider } from './contexts/ReceiptsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ReceiptsProvider>
        <App />
      </ReceiptsProvider>
    </AuthProvider>
  </React.StrictMode>
);