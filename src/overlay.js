const canvas = document.getElementById('selectionCanvas');
const ctx = canvas.getContext('2d');
const controlPanel = document.getElementById('controlPanel');
const summarizeButton = document.getElementById('summarizeButton');
const translateButton = document.getElementById('translateButton');
const explainButton = document.getElementById('explainButton');
const answerButton = document.getElementById('answerButton');
const customButton = document.getElementById('customButton');
const cancelButton = document.getElementById('cancelButton');
const customTextarea = document.getElementById('customTextarea');
const confirmButton = document.getElementById('confirmButton');
const customText = document.getElementById('customText');

let isSelecting = false;
let startX = 0, startY = 0;
let endX = 0, endY = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function drawSelection() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  ctx.clearRect(x, y, w, h);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

canvas.addEventListener('mousedown', (e) => {
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;
  endX = startX;
  endY = startY;
  drawSelection();
});

canvas.addEventListener('mousemove', (e) => {
  if (isSelecting) {
    controlPanel.style.display = 'none';
    customTextarea.style.display = 'none';
    confirmButton.style.display = 'none';
    customTextarea.value = '';
    customButton.classList.remove('active');
    endX = e.clientX;
    endY = e.clientY;
    drawSelection();
  }
});

canvas.addEventListener('mouseup', () => {
  isSelecting = false;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  if (w > 0 && h > 0) {
    controlPanel.style.display = 'flex';
    controlPanel.style.flexDirection = 'column';
    controlPanel.style.top = `${y}px`;
    controlPanel.style.left = `${x + w + 10}px`;
    
    const controlPanelHeight = controlPanel.clientHeight;
    if (y + controlPanelHeight > window.innerHeight) {
      controlPanel.style.top = `${window.innerHeight - controlPanelHeight}px`;
    }
    const controlPanelWidth = controlPanel.clientWidth;
    if (x + w + controlPanelWidth > window.innerWidth) {
      controlPanel.style.left = `${x - controlPanelWidth - 10}px`;
    }

    summarizeButton.onclick = () => {
      window.electronAPI.captureRegion({ x, y, width: w, height: h }, "summary");
    };

    translateButton.onclick = () => {
      window.electronAPI.captureRegion({ x, y, width: w, height: h }, "translate");
    }

    explainButton.onclick = () => {
      window.electronAPI.captureRegion({ x, y, width: w, height: h }, "explain");
    }

    customButton.onclick = () => {
      customTextarea.style.display = 'block';
      confirmButton.style.display = 'block';
      customButton.classList.add('active');
      customTextarea.focus();
    }

    confirmButton.onclick = () => {
      const customPrompt = customTextarea.value;
      if (customPrompt) {
        window.electronAPI.captureRegion({ x, y, width: w, height: h }, customPrompt);
      }
      customTextarea.style.display = 'none';
      confirmButton.style.display = 'none';
      customTextarea.value = '';
    };

    answerButton.onclick = () => {
      window.electronAPI.captureRegion({ x, y, width: w, height: h }, "answer");
    }

    cancelButton.onclick = () => {
      window.electronAPI.cancelOverlay();
    };
  } else {
    window.electronAPI.cancelOverlay();
  }
});
