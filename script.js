
const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const output = document.getElementById("output");

let objects = [];
let zoom = 1;
let gridSize = 50;
let playMode = false;
let selectedObject = null;
let draggingObject = false;
let resizing = false;
let dragScene = false;
let offsetX = 0, offsetY = 0;
let cameraX = 0, cameraY = 0;
let dragStartX = 0, dragStartY = 0;
let imageCache = {};
let player = { x: 100, y: 100, size: 40 };

function resizeCanvas() {
  canvas.width = window.innerWidth - 260;
  canvas.height = window.innerHeight;
  drawScene();
}
window.addEventListener("resize", resizeCanvas);

function drawGrid() {
  const step = gridSize * zoom;
  ctx.strokeStyle = "#ccc";
  for (let x = -cameraX % step; x < canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -cameraY % step; y < canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawObjects() {
  objects.forEach((obj) => {
    if (!obj || obj.w <= 0 || obj.h <= 0) return;
    const img = imageCache[obj.src];
    if (img) {
      const x = (obj.x - cameraX) * zoom;
      const y = (obj.y - cameraY) * zoom;
      const w = obj.w * zoom;
      const h = obj.h * zoom;
      ctx.drawImage(img, x, y, w, h);
      if (obj === selectedObject) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "white";
        ctx.fillRect(x + w - 8, y + h - 8, 8, 8);
        ctx.strokeStyle = "black";
        ctx.strokeRect(x + w - 8, y + h - 8, 8, 8);
      }
    }
  });
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawObjects();
  if (playMode) {
    ctx.fillStyle = "blue";
    const px = (player.x - cameraX) * zoom;
    const py = (player.y - cameraY) * zoom;
    const ps = player.size * zoom;
    ctx.fillRect(px, py, ps, ps);
  }
}

fileInput.addEventListener("change", () => {
  [...fileInput.files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const originalImg = new Image();
      originalImg.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 128;
        canvas.height = 128;
        try {
          ctx.drawImage(originalImg, 0, 0, 128, 128);
          const resizedSrc = canvas.toDataURL("image/png");
          const resizedImg = new Image();
          resizedImg.src = resizedSrc;
          resizedImg.onload = () => {
            if (resizedImg.width === 0 || resizedImg.height === 0) {
              console.warn("Ignored invalid image:", file.name);
              return;
            }
            imageCache[resizedSrc] = resizedImg;
            const thumbnail = document.createElement("img");
            thumbnail.src = resizedSrc;
            thumbnail.draggable = true;
            thumbnail.ondragstart = (ev) => {
              ev.dataTransfer.setData("text/plain", resizedSrc);
            };
            fileList.appendChild(thumbnail);
          };
        } catch (e) {
          console.error("Error processing image:", e);
        }
      };
      originalImg.src = src;
    };
    reader.readAsDataURL(file);
  });
});

canvas.addEventListener("dragover", (ev) => ev.preventDefault());
canvas.addEventListener("drop", (ev) => {
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const rawX = (ev.clientX - rect.left) / zoom + cameraX;
  const rawY = (ev.clientY - rect.top) / zoom + cameraY;
  const x = Math.floor(rawX / gridSize) * gridSize;
  const y = Math.floor(rawY / gridSize) * gridSize;
  const src = ev.dataTransfer.getData("text/plain");
  if (imageCache[src]) {
    objects.push({ src, x, y, w: gridSize, h: gridSize });
    drawScene();
  }
});

canvas.addEventListener("mousedown", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (ev.clientX - rect.left) / zoom + cameraX;
  const my = (ev.clientY - rect.top) / zoom + cameraY;
  const cx = ev.clientX;
  const cy = ev.clientY;
  if (ev.altKey) {
    dragScene = true;
    dragStartX = cx;
    dragStartY = cy;
    return;
  }
  selectedObject = null;
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const right = obj.x + obj.w;
    const bottom = obj.y + obj.h;
    const isResizeHandle = mx >= right - 8 && mx <= right && my >= bottom - 8 && my <= bottom;
    if (isResizeHandle) {
      selectedObject = obj;
      resizing = true;
      return;
    }
    if (mx >= obj.x && mx <= right && my >= obj.y && my <= bottom) {
      selectedObject = obj;
      draggingObject = true;
      offsetX = mx - obj.x;
      offsetY = my - obj.y;
      break;
    }
  }
  drawScene();
});

canvas.addEventListener("mousemove", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (ev.clientX - rect.left) / zoom + cameraX;
  const my = (ev.clientY - rect.top) / zoom + cameraY;
  const dx = ev.clientX - dragStartX;
  const dy = ev.clientY - dragStartY;
  if (dragScene) {
    cameraX -= dx / zoom;
    cameraY -= dy / zoom;
    dragStartX = ev.clientX;
    dragStartY = ev.clientY;
    drawScene();
    return;
  }
  if (draggingObject && selectedObject) {
    selectedObject.x = Math.floor((mx - offsetX) / gridSize) * gridSize;
    selectedObject.y = Math.floor((my - offsetY) / gridSize) * gridSize;
    drawScene();
  }
  if (resizing && selectedObject) {
    selectedObject.w = Math.max(10, mx - selectedObject.x);
    selectedObject.h = Math.max(10, my - selectedObject.y);
    drawScene();
  }
});

canvas.addEventListener("mouseup", () => {
  draggingObject = false;
  resizing = false;
  dragScene = false;
});

window.addEventListener("keydown", (e) => {
  if (selectedObject && !playMode) {
    if (e.key === "ArrowUp") selectedObject.y -= gridSize;
    if (e.key === "ArrowDown") selectedObject.y += gridSize;
    if (e.key === "ArrowLeft") selectedObject.x -= gridSize;
    if (e.key === "ArrowRight") selectedObject.x += gridSize;
    if (e.key === "+" || e.key === "=") {
      selectedObject.w += 10;
      selectedObject.h += 10;
    }
    if (e.key === "-" || e.key === "_") {
      selectedObject.w = Math.max(10, selectedObject.w - 10);
      selectedObject.h = Math.max(10, selectedObject.h - 10);
    }
  }
  if (playMode) {
    const speed = 10;
    if (e.key === "w") player.y -= speed;
    if (e.key === "s") player.y += speed;
    if (e.key === "a") player.x -= speed;
    if (e.key === "d") player.x += speed;
  }
  drawScene();
});

function zoomIn() { zoom *= 1.25; drawScene(); }
function zoomOut() { zoom /= 1.25; drawScene(); }
function togglePlay() { playMode = !playMode; drawScene(); }
function saveMap() { output.value = JSON.stringify(objects, null, 2); }
function clearScene() { objects = []; drawScene(); }
function exitEditor() { window.close(); }

resizeCanvas();
