import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { validateEnvironment } from './utils/envValidation';

// Validate environment before mounting
const { valid, errors } = validateEnvironment();
if (!valid) {
  document.body.innerHTML = `
        <div style="font-family: monospace; padding: 2rem; background: #0f172a; color: #ef4444; min-height: 100vh;">
            <h1 style="color: #f8fafc; font-size: 1.5rem; margin-bottom: 1rem;">⚠️ Configuration Error</h1>
            <p style="color: #94a3b8; margin-bottom: 1rem;">The application cannot start due to missing environment variables:</p>
            ${errors.map((e: string) => `<p style="margin: 0.5rem 0; color: #fca5a5;">• ${e}</p>`).join('')}
            <p style="color: #64748b; margin-top: 2rem; font-size: 0.875rem;">Please check your .env.local file or deployment environment settings.</p>
        </div>
    `;
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}