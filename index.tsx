import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ReceiptsProvider } from './contexts/ReceiptsContext';
import { ReceiptPresetsProvider } from './contexts/ReceiptPresetsContext';
import { ReceiptImagesProvider } from './contexts/ReceiptImagesContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ReceiptPresetsProvider>
        <ReceiptImagesProvider>
          <ReceiptsProvider>
            <App />
          </ReceiptsProvider>
        </ReceiptImagesProvider>
      </ReceiptPresetsProvider>
    </AuthProvider>
  </React.StrictMode>
);