// =============================
// 障害物編集モード専用 script.js
// グリッド + 障害物操作（追加/移動/回転/反転/削除/選択/ドラッグ移動）
// =============================

// ---- キャンバス設定 ----
const canvas = document.getElementById("visionCanvas");
const ctx = canvas.getContext("2d");

// 1マスの大きさ（セルサイズ）とマップの行列数
const cellSize = 30;
const cols = 16;  // 横16セル
const rows = 36;  // 縦36セル

// キャンバスサイズをグリッドサイズに合わせる
canvas.width = cols * cellSize;
canvas.height = rows * cellSize;

// ---- 障害物管理 ----
// 仕様変更：obstacle = { type, shapes, anchorPoint:{x,y}, rotationAngle:number, anchor:string }
const obstacles = [];
let selectedObstacleIndex = null;

// 形状の表示名
const shapeNames = {
  small_triangle: "小三角形",
  big_triangle: "大三角形",
  rhombus: "ひし形",
  trapezoid: "台形"
};

// ---- グリッド基準点(anchorIndex)に合わせて図形を配置 ----
function alignShapeToGrid(points, gx, gy, anchorIndex) {
  const ox = gx * cellSize - points[anchorIndex].x;
  const oy = gy * cellSize - points[anchorIndex].y;
  return points.map(p => ({ x: p.x + ox, y: p.y + oy }));
}

// ---- 回転ユーティリティ ----
function rotatePoint(px, py, cx, cy, angleDeg) {
  const r = angleDeg * Math.PI / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function rotateObstacle(shapes, deg, cx, cy) {
  return shapes.map(poly => poly.map(p => rotatePoint(p.x, p.y, cx, cy, deg)));
}

// ---- 各形状を生成する関数 ----
function createTriangleAtGridPoint(x, y, ang = 0, anch = "topLeft") {
  const s = 2 * cellSize * 0.9, h = Math.sqrt(3) / 2 * s;
  let pts = [{ x: 0, y: 0 }, { x: -s / 2, y: h }, { x: s / 2, y: h }];
  let ai = anch === "bottomLeft" ? 1 : anch === "bottomRight" ? 2 : 0;
  pts = alignShapeToGrid(pts, x, y, ai);
  const cx = pts[ai].x, cy = pts[ai].y;
  return pts.map(p => rotatePoint(p.x, p.y, cx, cy, ang));
}

function createBigTriangleAtGridPoint(x, y, ang = 0, anch = "topLeft") {
  const s = 4 * cellSize * 0.9, h = Math.sqrt(3) / 2 * s;
  let pts = [{ x: 0, y: 0 }, { x: -s / 2, y: h }, { x: s / 2, y: h }];
  let ai = anch === "bottomLeft" ? 1 : anch === "bottomRight" ? 2 : 0;
  pts = alignShapeToGrid(pts, x, y, ai);
  const cx = pts[ai].x, cy = pts[ai].y;
  return pts.map(p => rotatePoint(p.x, p.y, cx, cy, ang));
}

function createRhombusAtGridPoint(x, y, ang = 0, anch = "topLeft") {
  const s = 2 * cellSize * 0.9, r = Math.PI / 3;
  let pts = [
    { x: 0, y: 0 },
    { x: s, y: 0 },
    { x: s + s * Math.cos(r), y: s * Math.sin(r) },
    { x: s * Math.cos(r), y: s * Math.sin(r) }
  ];
  let ai = anch === "topRight" ? 1 : anch === "bottomRight" ? 2 : anch === "bottomLeft" ? 3 : 0;
  pts = alignShapeToGrid(pts, x, y, ai);
  const cx = pts[ai].x, cy = pts[ai].y;
  return pts.map(p => rotatePoint(p.x, p.y, cx, cy, ang));
}

function createTrapezoidAtGridPoint(x, y, ang = 0, anch = "topLeft") {
  const tw = 2 * cellSize * 0.9, bw = 2 * tw, h = Math.sqrt(3) / 2 * tw;
  let pts = [
    { x: 0, y: 0 },
    { x: tw, y: 0 },
    { x: tw + (bw - tw) / 2, y: h },
    { x: -(bw - tw) / 2, y: h }
  ];
  let ai = anch === "topRight" ? 1 : anch === "bottomRight" ? 2 : anch === "bottomLeft" ? 3 : 0;
  pts = alignShapeToGrid(pts, x, y, ai);
  const cx = pts[ai].x, cy = pts[ai].y;
  return pts.map(p => rotatePoint(p.x, p.y, cx, cy, ang));
}

// ---- 形状の再生成ヘルパー（type/anchorPoint/rotationAngle/anchor から shapes を作る）----
function regenerateShape(type, gx, gy, ang, anchor) {
  if (type === "small_triangle") return createTriangleAtGridPoint(gx, gy, ang, anchor);
  if (type === "big_triangle")    return createBigTriangleAtGridPoint(gx, gy, ang, anchor);
  if (type === "rhombus")         return createRhombusAtGridPoint(gx, gy, ang, anchor);
  if (type === "trapezoid")       return createTrapezoidAtGridPoint(gx, gy, ang, anchor);
  return [];
}

// ---- 障害物一覧UI更新 ----
function updateObstacleList() {
  const l = document.getElementById("obstacleList");
  l.innerHTML = "";
  const cnt = {};
  obstacles.forEach((o, i) => {
    const tn = shapeNames[o.type] || "障害物";
    cnt[o.type] = (cnt[o.type] || 0) + 1;
    const li = document.createElement("li");
    li.textContent = `${tn} ${cnt[o.type]}`;
    li.addEventListener("click", () => { selectedObstacleIndex = i; updateSelectedUI(); });
    const b = document.createElement("button");
    b.textContent = "削除";
    b.onclick = e => {
      e.stopPropagation();
      obstacles.splice(i, 1);
      if (selectedObstacleIndex === i) { selectedObstacleIndex = null; updateSelectedUI(); }
      updateObstacleList();
    };
    li.appendChild(b);
    l.appendChild(li);
  });
}

function updateSelectedUI() {
  const l = document.getElementById("selectedLabel");
  const btn = document.getElementById("applyRotationBtn");
  if (selectedObstacleIndex !== null) {
    const cnt = {};
    let dn = "";
    obstacles.forEach((o, i) => {
      cnt[o.type] = (cnt[o.type] || 0) + 1;
      if (i === selectedObstacleIndex) dn = `${shapeNames[o.type]} ${cnt[o.type]}`;
    });
    l.textContent = `選択中: ${dn}`;
    btn.disabled = false;
  } else {
    l.textContent = "選択中: なし";
    btn.disabled = true;
  }
}

// ---- 障害物操作イベント ----
document.getElementById("addObstacleBtn").addEventListener("click", () => {
  const gx = parseInt(document.getElementById("cellX").value);
  const gy = parseInt(document.getElementById("cellY").value);
  const st = document.getElementById("shapeType").value;
  const anchor = document.getElementById("vertexAnchor").value;

  // 生成角は初期0
  const rotationAngle = 0;
  const shape = regenerateShape(st, gx, gy, rotationAngle, anchor);

  obstacles.push({
    type: st,
    shapes: [shape],
    anchorPoint: { x: gx * cellSize, y: gy * cellSize },
    rotationAngle: rotationAngle,
    anchor: anchor
  });
  updateObstacleList();
});

// 🚩 全削除（確認ポップアップ付き）
document.getElementById("clearObstaclesBtn").addEventListener("click", () => {
  if (confirm("本当にすべての障害物を削除しますか？")) {
    obstacles.length = 0;
    selectedObstacleIndex = null;
    updateObstacleList();
    updateSelectedUI();
  }
});

// 選択回転（基準点は常に anchorPoint）
document.getElementById("applyRotationBtn").addEventListener("click", () => {
  if (selectedObstacleIndex !== null) {
    const deg = parseFloat(document.getElementById("rotateAngleInput").value);
    const o = obstacles[selectedObstacleIndex];
    const a = o.anchorPoint;
    // 見た目の形を回転
    o.shapes = rotateObstacle(o.shapes, deg, a.x, a.y);
    // 角度を内部状態としても保持（保存→再生成で再現できるように）
    o.rotationAngle = normalizeAngle(o.rotationAngle + deg);
    updateObstacleList();
  }
});

// 角度正規化（-360..360 を 0..360 に）
function normalizeAngle(a) {
  let r = a % 360;
  if (r < 0) r += 360;
  return r;
}

// 反転コピー（キャンバス中心対称）
// 中心対称は「中心回り180°回転」と等価。
// 保存→再読込で形状一致させるため、コピー側の rotationAngle を +180 しておく。
document.getElementById("mirrorObstaclesBtn").addEventListener("click", () => {
  const c = { x: canvas.width / 2, y: canvas.height / 2 };
  const m = obstacles.map(o => ({
    type: o.type,
    shapes: o.shapes.map(s => s.map(p => ({ x: 2 * c.x - p.x, y: 2 * c.y - p.y }))),
    anchorPoint: { x: 2 * c.x - o.anchorPoint.x, y: 2 * c.y - o.anchorPoint.y },
    rotationAngle: normalizeAngle((o.rotationAngle || 0) + 180),
    anchor: o.anchor
  }));
  obstacles.push(...m);
  updateObstacleList();
});

// ---- 移動可否チェック ----
function canMoveObstacle(obstacle, dx, dy) {
  // 全頂点を仮移動してチェック
  for (const shape of obstacle.shapes) {
    for (const p of shape) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx < 0 || nx > canvas.width || ny < 0 || ny > canvas.height) {
        return false; // 範囲外 → 移動不可
      }
    }
  }
  return true; // 全頂点OKなら移動可能
}

// ---- 選択中障害物を移動（矢印キー/十字ボタン用） ----
function moveSelectedObstacle(key) {
  if (selectedObstacleIndex === null) return;
  const o = obstacles[selectedObstacleIndex];
  let dx = 0, dy = 0;

  if (key === "ArrowUp") dy -= cellSize;
  if (key === "ArrowDown") dy += cellSize;
  if (key === "ArrowLeft") dx -= cellSize;
  if (key === "ArrowRight") dx += cellSize;

  if ((dx !== 0 || dy !== 0) && canMoveObstacle(o, dx, dy)) {
    // 実際に移動
    o.shapes = o.shapes.map(shape => shape.map(p => ({ x: p.x + dx, y: p.y + dy })));
    o.anchorPoint.x += dx;
    o.anchorPoint.y += dy;
  }
}

// ---- キーボード操作 ----
document.addEventListener("keydown", e => {
  moveSelectedObstacle(e.key); // 押すたびに1マス動く
});

// ---- モバイル十字ボタン操作 ----
function bindMobileButton(buttonId, keyName) {
  const btn = document.getElementById(buttonId);
  btn.addEventListener("touchstart", e => {
    e.preventDefault();
    moveSelectedObstacle(keyName); // タップ時に1マス動く
  });
}
bindMobileButton("btnUp", "ArrowUp");
bindMobileButton("btnDown", "ArrowDown");
bindMobileButton("btnLeft", "ArrowLeft");
bindMobileButton("btnRight", "ArrowRight");

// ---- キャンバス座標変換（CSS拡縮対応） ----
function getCanvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// ---- ポリゴン判定 ----
function isPointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---- クリック/タップで障害物選択 ----
function pickObstacleAt(x, y) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    for (const s of o.shapes) {
      if (isPointInPolygon({ x, y }, s)) {
        selectedObstacleIndex = i;
        updateSelectedUI();
        return true;
      }
    }
  }
  selectedObstacleIndex = null;
  updateSelectedUI();
  return false;
}

function isPointOnSelectedObstacle(pt) {
  if (selectedObstacleIndex === null) return false;
  const o = obstacles[selectedObstacleIndex];
  return o.shapes.some(s => isPointInPolygon(pt, s));
}

// ---- ドラッグ移動（選択中のみ） ----
let isDragging = false;
let lastDragX = 0;
let lastDragY = 0;
let accumDX = 0; // 未処理のドラッグ移動量（X）
let accumDY = 0; // 未処理のドラッグ移動量（Y）

// mousedown：選択/ドラッグ開始判定を一括で処理
canvas.addEventListener("mousedown", (e) => {
  const p = getCanvasPoint(e.clientX, e.clientY);

  // まず、選択状態の上かどうかでドラッグ開始判定
  if (selectedObstacleIndex !== null && isPointOnSelectedObstacle(p)) {
    isDragging = true;
    lastDragX = p.x;
    lastDragY = p.y;
    accumDX = 0;
    accumDY = 0;
    return;
  }

  // そうでなければ選択処理のみ（このクリックではドラッグ開始しない）
  pickObstacleAt(p.x, p.y);
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging || selectedObstacleIndex === null) return;
  const p = getCanvasPoint(e.clientX, e.clientY);

  // 前フレームからの移動量を加算
  accumDX += (p.x - lastDragX);
  accumDY += (p.y - lastDragY);
  lastDragX = p.x;
  lastDragY = p.y;

  // X方向のしきい値処理（1マス単位で複数ステップ分も処理）
  while (accumDX >= cellSize || accumDX <= -cellSize) {
    const step = accumDX >= cellSize ? cellSize : -cellSize;
    tryMoveSelected(step, 0);
    accumDX -= step; // 成否に関わらずしきい値分だけ減算（引っかかったら次の動き待ち）
  }

  // Y方向のしきい値処理
  while (accumDY >= cellSize || accumDY <= -cellSize) {
    const step = accumDY >= cellSize ? cellSize : -cellSize;
    tryMoveSelected(0, step);
    accumDY -= step;
  }
});

function tryMoveSelected(dx, dy) {
  const o = obstacles[selectedObstacleIndex];
  if (canMoveObstacle(o, dx, dy)) {
    o.shapes = o.shapes.map(shape => shape.map(p => ({ x: p.x + dx, y: p.y + dy })));
    o.anchorPoint.x += dx;
    o.anchorPoint.y += dy;
  }
}

function endDrag() {
  isDragging = false;
  accumDX = 0;
  accumDY = 0;
}

canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);

// ---- タッチ操作（スマホ用） ----
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const p = getCanvasPoint(t.clientX, t.clientY);

  // 選択済みの上でのみドラッグ開始
  if (selectedObstacleIndex !== null && isPointOnSelectedObstacle(p)) {
    isDragging = true;
    lastDragX = p.x;
    lastDragY = p.y;
    accumDX = 0;
    accumDY = 0;
  } else {
    // タップで選択（このタップではドラッグ開始しない）
    pickObstacleAt(p.x, p.y);
  }
}, { passive: true });

canvas.addEventListener("touchmove", (e) => {
  if (!isDragging || selectedObstacleIndex === null) return;
  if (e.touches.length !== 1) return;
  // ドラッグ中はスクロールを抑止（iOS対策）
  e.preventDefault();

  const t = e.touches[0];
  const p = getCanvasPoint(t.clientX, t.clientY);

  accumDX += (p.x - lastDragX);
  accumDY += (p.y - lastDragY);
  lastDragX = p.x;
  lastDragY = p.y;

  while (accumDX >= cellSize || accumDX <= -cellSize) {
    const step = accumDX >= cellSize ? cellSize : -cellSize;
    tryMoveSelected(step, 0);
    accumDX -= step;
  }
  while (accumDY >= cellSize || accumDY <= -cellSize) {
    const step = accumDY >= cellSize ? cellSize : -cellSize;
    tryMoveSelected(0, step);
    accumDY -= step;
  }
}, { passive: false }); // preventDefaultを使うため passive:false

canvas.addEventListener("touchend", endDrag, { passive: true });
canvas.addEventListener("touchcancel", endDrag, { passive: true });

// ---- 障害物描画 ----
function drawObstacles() {
  obstacles.forEach((o, i) => {
    ctx.fillStyle = "#006affff"; // 水色（#RRGGBBAA）
    o.shapes.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let k = 1; k < s.length; k++) ctx.lineTo(s[k].x, s[k].y);
      ctx.closePath();
      ctx.fill();
      if (i === selectedObstacleIndex) {
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  });
}

// ---- グリッド描画 ----
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 縦線 + X座標ラベル
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#888";
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, canvas.height);
    ctx.stroke();
    if (i % 2 === 0 && i < cols) {
      ctx.fillStyle = "#fff";
      ctx.font = "10px Arial";
      ctx.fillText(i, i * cellSize + 2, 10);
    }
  }

  // 横線 + Y座標ラベル
  for (let j = 0; j <= rows; j++) {
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#888";
    ctx.moveTo(0, j * cellSize);
    ctx.lineTo(canvas.width, j * cellSize);
    ctx.stroke();
    if (j % 2 === 0 && j < rows) {
      ctx.fillStyle = "#fff";
      ctx.font = "10px Arial";
      ctx.fillText(j, 2, j * cellSize + 10);
    }
  }
}

// ---- モバイルコントロールUIは常に表示 ----
document.getElementById("mobileControls").style.display = "flex";

// ---- 二本指操作禁止（ピンチ検出） ----
document.addEventListener("touchmove", function (e) {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault());

let lastTouchEnd = 0;
document.addEventListener("touchend", e => {
  const now = new Date().getTime();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, false);

// ---- 安全なvw/vh計算（iOS Safari対策） ----
function setViewportUnits() {
  let vw = window.innerWidth * 0.01;
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vw', `${vw}px`);
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setViewportUnits();
window.addEventListener('resize', setViewportUnits);
window.addEventListener('orientationchange', setViewportUnits);

// ---- マップ保存処理（JPEG有効化） ----
document.getElementById("downloadMapBtn").addEventListener("click", () => {
  // キャンバスをJPEG画像に変換
  const dataURL = canvas.toDataURL("image/jpeg");

  // ファイル名を日時付きで生成
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
  const filename = `map_${timestamp}.jpg`;

  // ダウンロード処理
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// ---- JSON保存処理（仕様変更：最小情報のみ保存） ----
document.getElementById("saveJsonBtn").addEventListener("click", () => {
  const mapName = document.getElementById("mapNameInput").value.trim();
  if (!mapName) {
    alert("マップ名を入力してください");
    return;
  }

  // 保存するデータ：type / anchorPoint / rotationAngle / anchor のみ
  const mapData = {
    mapName: mapName,
    createdAt: new Date().toISOString(),
    obstacles: obstacles.map(o => ({
      type: o.type,
      anchorPoint: { x: o.anchorPoint.x, y: o.anchorPoint.y },
      rotationAngle: o.rotationAngle || 0,
      anchor: o.anchor || "topLeft"
    }))
  };

  // JSON化（整形付き）
  const jsonData = JSON.stringify(mapData, null, 2);

  // Blob生成
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // ダウンロード処理
  const link = document.createElement("a");
  link.href = url;
  link.download = `${mapName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // メモリ解放
  URL.revokeObjectURL(url);
});

// ---- JSON読み込み処理（仕様変更：再生成） ----
document.getElementById("loadJsonBtn").addEventListener("click", () => {
  // 隠しファイル入力をクリック
  document.getElementById("loadJsonInput").click();
});

document.getElementById("loadJsonInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const mapData = JSON.parse(e.target.result);

      // マップ名をUIに反映
      if (mapData.mapName) {
        document.getElementById("mapNameInput").value = mapData.mapName;
      }

      // 既存マップをクリアして上書き
      if (Array.isArray(mapData.obstacles)) {
        obstacles.length = 0; // クリア

        mapData.obstacles.forEach(o => {
          // 後方互換：旧データ（shapesのみ）などは破棄し、最低限 type + anchorPoint が必要
          if (o && o.type && o.anchorPoint && typeof o.anchorPoint.x === "number" && typeof o.anchorPoint.y === "number") {
            const ang = normalizeAngle(o.rotationAngle || 0);
            const anchor = o.anchor || "topLeft";
            // anchorPoint をセル座標に換算（基本的に20の倍数のはず）
            const gx = Math.round(o.anchorPoint.x / cellSize);
            const gy = Math.round(o.anchorPoint.y / cellSize);
            const shape = regenerateShape(o.type, gx, gy, ang, anchor);

            obstacles.push({
              type: o.type,
              shapes: [shape],
              anchorPoint: { x: gx * cellSize, y: gy * cellSize }, // 正規化して再設定
              rotationAngle: ang,
              anchor: anchor
            });
          }
        });
      } else {
        alert("不正なJSONフォーマットです: obstacles が見つかりません");
        return;
      }

      // 選択解除 & UI更新
      selectedObstacleIndex = null;
      updateObstacleList();
      updateSelectedUI();
    } catch (err) {
      alert("JSONの読み込みに失敗しました: " + err.message);
    }
  };

  reader.readAsText(file);
});

// ---- メインループ ----
function animate() {
  drawGrid();
  drawObstacles();
  requestAnimationFrame(animate);
}
animate();
