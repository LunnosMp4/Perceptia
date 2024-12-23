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
let responseWindow = null;

let lastPrompt = null;
let lastScreenshot = null;
let currentLanguage = "English";

async function createResponseWindow() {
  if (responseWindow && !responseWindow.isDestroyed()) {
    responseWindow.focus();
    return;
  }

  const { x, y } = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint({ x, y });
  const { bounds } = currentDisplay;

  const windowX = bounds.x + bounds.width - 650;
  const windowY = bounds.y + 50;

  responseWindow = new BrowserWindow({
    width: 600,
    height: 400,
    x: windowX,
    y: windowY,
    title: "AI Response",
    resizable: false,
    transparent: false,
    frame: false,
    backgroundMaterial: 'mica',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'response-preload.js'),
    },
  });

  responseWindow.loadFile('src/response.html');
  responseWindow.setAlwaysOnTop(true, 'floating');
  responseWindow.setFullScreenable(false);
  responseWindow.setResizable(false);
  responseWindow.setMovable(true);

  responseWindow.on('closed', () => {
    responseWindow = null;
  });
}

async function createOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return;
  }

  const { x, y } = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint({ x, y });

  const { bounds } = currentDisplay;

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
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

  overlayWindow.webContents.on('did-finish-load', async () => {
    await overlayWindow.webContents.executeJavaScript(`
      document.getElementById('languageSelect').value = "${currentLanguage}";
    `);
  });

  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setFullScreenable(false);
  overlayWindow.setFullScreen(true);
  overlayWindow.setResizable(false);
  overlayWindow.setMovable(false);

  overlayWindow.on('ready-to-show', () => {
    overlayWindow.show();
  });
}

function registerGlobalShortcut() {
  globalShortcut.register('Control+Alt+N', () => {
    if (responseWindow && !responseWindow.isDestroyed()) {
      responseWindow.close();
      responseWindow = null;
    }
    createOverlay();
  });

  globalShortcut.register('Control+Alt+G', () => {
    createResponseWindow();
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
  if (mode.startsWith("translate") && mode.split(" ").length === 2) {
    const language = mode.split(" ")[1];
    return "Translate the text in this screenshot into " + language + " exactly, with no rephrasing or modifications, do not rewrite the original text. Provide only the translation, without explanations or additional comments. Avoid describing the screenshot or app interface.";
  }

  switch (mode) {
    case "summary":
      return "Summarize the content of this screenshot into a concise and clear overview. Use markdown format. Make a short answer and go straight to the point. Include the key points or highlights. Avoid unnecessary details or lengthy explanations. Focus on summarizing the main ideas or events in the screenshot.";
    case "explain":
      return "Provide a detailed explanation of the content, focusing on its context, and key ideas. Use markdown format. Clarify any important terms and explain the significance of the events or concepts mentioned. If the text is short or unclear provide an explanation / definition on the text. Avoid irrelevant information or personal opinions. Do not summarize the content, but rather explain it in detail. Do not describe the screenshot or app interface.";
    case "answer":
      return "Read and answer the question or provide the requested information from the screenshot. For multiple-choice questions, identify the correct answer clearly. Use markdown format and be concise. Include only the necessary information to answer the question or provide the requested details. Avoid any additional explanations or irrelevant information.";
    default:
      return "Provide a clear and accurate response based on the user's question. Use markdown format. If the question is about identifying or explaining something, ensure you focus on the core details and provide relevant context. Avoid deviating from the user's request, and answer in a way that directly addresses their query. Now, here's the user's prompt:" + mode;
  }
}

async function sendAIRequest(imageDataURL, prompt) {
  try {
    const stream = await client.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataURL } }
          ]
        }
      ],
      stream: true,
      temperature: 0.5,
    });

    lastPrompt = prompt;
    lastScreenshot = imageDataURL;
    await createResponseWindow();

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content || "";
      responseWindow.webContents.send('ai-stream', text);
    }
  } catch (error) {
    console.error("Error calling the AI model:", error);
  }
}

ipcMain.handle('request-ai-stream', async () => {
  if (lastPrompt && lastScreenshot) {
    await sendAIRequest(lastScreenshot, lastPrompt);
  }
});

ipcMain.handle('capture-region', async (event, { x, y, width, height }, mode) => {
  const { x: cursorX, y: cursorY } = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
  const { bounds, scaleFactor } = currentDisplay;

  const logicalWidth = bounds.width;
  const logicalHeight = bounds.height;

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

  const currentSource = sources.find(source => source.display_id === `${currentDisplay.id}`);
  if (!currentSource) {
    throw new Error('Could not find source for current display.');
  }

  const thumbnail = currentSource.thumbnail;

  const croppedImage = thumbnail.crop({
    x: px,
    y: py,
    width: pwidth,
    height: pheight
  });
  const buffer = croppedImage.toPNG();

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }

  const prompt = getPrompt(mode);
  await sendAIRequest(croppedImage.toDataURL(), prompt);
});

ipcMain.handle('cancel-overlay', async () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
});

ipcMain.handle('close-window', async () => {
  if (responseWindow && !responseWindow.isDestroyed()) {
    responseWindow.close();
    responseWindow = null;
  }
});

ipcMain.handle('save-language', async (event, language) => {
  currentLanguage = language;
});
