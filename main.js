import { app, BrowserWindow, globalShortcut, screen, ipcMain, desktopCapturer } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let overlayWindow = null;

async function createOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    frame: false,
    transparent: true,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  overlayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
        overlayWindow = null;
      }
      event.preventDefault();
    }
  });

  overlayWindow.loadFile('src/overlay.html');
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setFullScreenable(false);

  overlayWindow.on('ready-to-show', () => {
    overlayWindow.show();
  });
}

function registerGlobalShortcut() {
  globalShortcut.register('Control+Alt+N', () => {
    createOverlay();
  });
}

app.whenReady().then(() => {
  registerGlobalShortcut();

  // Prevent the app from quitting when all windows are closed.
  // This keeps it running in the background, waiting for the shortcut.
  app.on('window-all-closed', (e) => {
    e.preventDefault();
  });

  app.on('activate', () => {
    // If needed, handle activate here.
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function getPrompt(mode) {
  switch (mode) {
    case "summary":
      return "Summarize the content of this screenshot into a concise and clear overview. Make a short answer and go straight to the point. Include the key points or highlights.";
    case "translate":
      return "Translate the text in this screenshot into English exactly, with no rephrasing or modifications. Provide only the translation, without explanations or additional comments.";
    case "explain":
      return "Provide a detailed explanation of the content, focusing on its context, background, and key ideas. Clarify any important terms and explain the significance of the events or concepts mentioned. Avoid describing the screenshot or app interface.";
    case "answer":
      return "Answer the question or provide the information requested in this screenshot. Be concise and clear. Include only the relevant information needed to answer the question or provide the requested information. Do not include any additional information or explanations.";
    default:
      return "Analyze the content of this screenshot and provide relevant insights or actions.";
  }
}

async function sendAIRequest(imageDataURL, prompt) {
  try {
    const chatCompletion = await client.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          "role": "user",
          "content": [
            { "type": "text", "text": prompt },
            {
              "type": "image_url",
              "image_url": { "url": imageDataURL }
            }
          ]
        }
      ]
    });

    console.log("AI response:", chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error("Error calling the AI model:", error);
  }
}

ipcMain.handle('capture-region', async (event, { x, y, width, height }, mode) => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: logicalWidth, height: logicalHeight } = primaryDisplay.bounds;
  const scaleFactor = primaryDisplay.scaleFactor || 1;

  const physicalWidth = Math.floor(logicalWidth * scaleFactor);
  const physicalHeight = Math.floor(logicalHeight * scaleFactor);

  const px = Math.floor(x * scaleFactor);
  const py = Math.floor(y * scaleFactor);
  const pwidth = Math.floor(width * scaleFactor);
  const pheight = Math.floor(height * scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: physicalWidth, height: physicalHeight }
  });

  const primarySource = sources[0];
  const thumbnail = primarySource.thumbnail;

  const croppedImage = thumbnail.crop({
    x: px,
    y: py,
    width: pwidth,
    height: pheight
  });
  const imageDataURL = croppedImage.toDataURL();
  
  const buffer = croppedImage.toPNG();
  const filePath = path.join(app.getPath('temp'), 'capture.png');
  fs.writeFileSync(filePath, buffer);
  console.log("Image saved to:", filePath);

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }

  const prompt = getPrompt(mode);
  await sendAIRequest(imageDataURL, prompt);
});

ipcMain.handle('cancel-overlay', async () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
});
