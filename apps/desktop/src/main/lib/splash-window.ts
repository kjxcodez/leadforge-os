import { BrowserWindow } from 'electron';
import { join } from 'path';
import fs from 'fs';

let splashWindow: BrowserWindow | null = null;

/**
 * Creates a lightweight, native, React-independent splash window to show immediately during app launch.
 */
export function createSplashWindow(): void {
  let iconBase64 = '';
  try {
    const iconPath = join(__dirname, '../../resources/icon.png');
    if (fs.existsSync(iconPath)) {
      iconBase64 = fs.readFileSync(iconPath).toString('base64');
    }
  } catch (err) {
    // fallback
  }

  splashWindow = new BrowserWindow({
    width: 400,
    height: 320,
    frame: false,
    transparent: true,
    show: true,
    center: true,
    resizable: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#09090b'
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #09090b;
            color: #f4f4f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
            -webkit-app-region: drag;
          }
          .logo-container {
            position: relative;
            margin-bottom: 24px;
          }
          .logo {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 16px;
          }
          .logo svg {
            width: 32px;
            height: 32px;
            color: white;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.025em;
            margin: 0;
          }
          .subtitle {
            font-size: 11px;
            color: #a1a1aa;
            margin-top: 6px;
          }
          .spinner {
            margin-top: 24px;
            width: 24px;
            height: 24px;
            border: 2px solid #27272a;
            border-top: 2px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <div class="logo">
            ${
              iconBase64
                ? `<img src="data:image/png;base64,${iconBase64}" />`
                : `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
              <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
              <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
            </svg>
            `
            }
          </div>
        </div>
        <h1 class="title">LeadForge Desktop</h1>
        <p class="subtitle">Starting up application...</p>
        <div class="spinner"></div>
      </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

/**
 * Cleanly closes and destroys the native splash window.
 */
export function destroySplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}
