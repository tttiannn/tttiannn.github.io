const stepsData = [
  { day: 1, steps: 6875 },
  { day: 2, steps: 1374 },
  { day: 3, steps: 1920 },
  { day: 4, steps: 2365 },
  { day: 5, steps: 3782 },
  { day: 6, steps: 4026 },
  { day: 7, steps: 4385 },
  { day: 8, steps: 6010 },
  { day: 9, steps: 5891 },
  { day: 10, steps: 969 },
  { day: 11, steps: 1664 },
  { day: 12, steps: 4035 },
  { day: 13, steps: 3031 },
  { day: 14, steps: 2116 },
  { day: 15, steps: 2748 },
  { day: 16, steps: 22255 },
  { day: 17, steps: 18591 },
  { day: 18, steps: 21971 },
  { day: 19, steps: 3132 },
  { day: 20, steps: 2601 },
  { day: 21, steps: 3181 },
  { day: 22, steps: 6482 },
  { day: 23, steps: 1172 },
  { day: 24, steps: 3469 },
  { day: 25, steps: 3127 },
  { day: 26, steps: 1897 },
  { day: 27, steps: 2752 },
  { day: 28, steps: 2106 },
  { day: 29, steps: 5198 },
  { day: 30, steps: 1627 }
];

const photoUrls = [
  "figures/figure1.jpg",
  "figures/figure2.jpg",
  "figures/figure3.jpg",
  "figures/figure4.jpg",
  "figures/figure5.jpg",
  "figures/figure6.jpg"
];

const body = document.body;
const stepsChart = document.getElementById("steps-chart");
const photoWall = document.getElementById("photo-wall");
const chartTitle = document.getElementById("chart-title");
const themeToggle = document.getElementById("theme-toggle");
const dayCompanion = document.getElementById("companion-day");
const nightCompanion = document.getElementById("companion-night");
const essayList = document.getElementById("essay-list");
const essayViewer = document.getElementById("essay-viewer");
const essayOverlay = document.getElementById("essay-overlay");
const closeEssay = document.getElementById("close-essay");
const photoOverlay = document.getElementById("photo-overlay");
const photoOverlayImage = document.getElementById("photo-overlay-image");
const closePhoto = document.getElementById("close-photo");
const gameOverlay = document.getElementById("game-overlay");
const closeGame = document.getElementById("close-game");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const particleLayer = document.getElementById("scroll-particles");
const footer = document.getElementById("page-footer");

let animationFrameId = null;
let activeCleanup = null;
let overlayResizeHandler = null;
let particleThrottle = false;
let essayEntries = [];

function openEssayOverlay() {
  essayOverlay.classList.add("active");
  essayOverlay.setAttribute("aria-hidden", "false");
  closeEssay.focus();
}

function closeEssayOverlay() {
  essayOverlay.classList.remove("active");
  essayOverlay.setAttribute("aria-hidden", "true");
}

function openPhotoOverlay(src, alt) {
  photoOverlayImage.src = src;
  photoOverlayImage.alt = alt;
  photoOverlay.classList.add("active");
  photoOverlay.setAttribute("aria-hidden", "false");
  closePhoto.focus();
}

function closePhotoOverlay() {
  photoOverlay.classList.remove("active");
  photoOverlay.setAttribute("aria-hidden", "true");
  photoOverlayImage.src = "";
}

function getEssayLoadHint() {
  if (window.location.protocol === "file:") {
    return "当前页面是通过 file:// 打开的，浏览器可能拦截本地 Markdown 读取。请改用本地静态服务器打开。";
  }

  return "";
}

function getBundledEssays() {
  if (Array.isArray(window.__ESSAY_DATA__) && window.__ESSAY_DATA__.length > 0) {
    return window.__ESSAY_DATA__;
  }

  return [];
}

function findBundledEssay(fileName) {
  return getBundledEssays().find((entry) => entry.file === fileName) || null;
}

function renderStepsChart() {
  const maxSteps = Math.max(...stepsData.map((item) => item.steps));
  const wrapper = document.createElement("div");
  wrapper.className = "chart-bars";

  stepsData.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = "bar-item";
    itemEl.dataset.steps = `${item.steps} 步`;
    itemEl.setAttribute("tabindex", "0");

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max((item.steps / maxSteps) * 210, 16)}px`;
    bar.title = `第${item.day}天：${item.steps}步`;
    bar.setAttribute("aria-label", `第${item.day}天，${item.steps}步`);

    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = item.day;

    itemEl.appendChild(bar);
    itemEl.appendChild(label);
    wrapper.appendChild(itemEl);
  });

  stepsChart.appendChild(wrapper);
}

function renderPhotoWall() {
  photoUrls.forEach((url, index) => {
    const slot = document.createElement("div");
    slot.className = "photo-slot";
    slot.setAttribute("tabindex", "0");

    const img = document.createElement("img");
    img.src = url;
    img.alt = `照片 ${index + 1}`;
    img.loading = "lazy";

    slot.addEventListener("click", () => {
      openPhotoOverlay(url, `放大查看照片 ${index + 1}`);
    });

    slot.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPhotoOverlay(url, `放大查看照片 ${index + 1}`);
      }
    });

    slot.appendChild(img);
    photoWall.appendChild(slot);
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks = [];
  let inCodeBlock = false;
  let codeLines = [];
  let listType = null;
  let listItems = [];
  let paragraphLines = [];
  let quoteLines = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      blocks.push(`<p>${renderInlineMarkdown(escapeHtml(paragraphLines.join(" ")))}</p>`);
      paragraphLines = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      const tag = listType === "ol" ? "ol" : "ul";
      const items = listItems.map((item) => `<li>${renderInlineMarkdown(escapeHtml(item))}</li>`).join("");
      blocks.push(`<${tag}>${items}</${tag}>`);
      listItems = [];
      listType = null;
    }
  }

  function flushQuote() {
    if (quoteLines.length > 0) {
      blocks.push(`<blockquote>${quoteLines.map((line) => `<p>${renderInlineMarkdown(escapeHtml(line))}</p>`).join("")}</blockquote>`);
      quoteLines = [];
    }
  }

  function flushCodeBlock() {
    if (codeLines.length > 0) {
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
    }
  }

  lines.forEach((line) => {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      flushQuote();
      if (inCodeBlock) {
        flushCodeBlock();
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`);
      return;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      quoteLines.push(trimmed.slice(2));
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(unorderedMatch[1]);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList();
    flushQuote();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushQuote();
  if (inCodeBlock) {
    flushCodeBlock();
  }

  return blocks.join("");
}

async function showEssay(entry, button) {
  try {
    let markdown = entry.content;

    if (!markdown) {
      try {
        const response = await fetch(`essays/${entry.file}`);
        if (!response.ok) {
          throw new Error("文章文件读取失败");
        }

        markdown = await response.text();
      } catch (fetchError) {
        const bundledEssay = findBundledEssay(entry.file);
        if (bundledEssay && bundledEssay.content) {
          markdown = bundledEssay.content;
        } else {
          throw fetchError;
        }
      }
    }
    essayViewer.innerHTML = markdownToHtml(markdown);
    openEssayOverlay();

    essayList.querySelectorAll(".essay-item").forEach((item) => item.classList.remove("active"));
    if (button) {
      button.classList.add("active");
    }
  } catch (error) {
    const hint = getEssayLoadHint();
    essayViewer.innerHTML = `<div class="essay-empty">读取文章失败：${escapeHtml(error.message)}${hint ? `<br>${escapeHtml(hint)}` : ""}</div>`;
  }
}

function renderEssayList(entries) {
  if (!entries.length) {
    essayList.innerHTML = '<div class="essay-empty">当前还没有可展示的随笔。</div>';
    essayViewer.innerHTML = '<div class="essay-empty">请先在 essays 文件夹中添加文章。</div>';
    return;
  }

  essayList.innerHTML = "";

  entries.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "essay-item";
    button.innerHTML = `
      <span class="essay-item-title">${escapeHtml(entry.title)}</span>
      <span class="essay-item-date">${escapeHtml(entry.date || "")}</span>
      <span class="essay-item-summary">${escapeHtml(entry.summary || "")}</span>
    `;

    button.addEventListener("click", () => {
      showEssay(entry, button);
    });

    essayList.appendChild(button);
  });
}

async function loadEssays() {
  try {
    const response = await fetch("essays/index.json");
    if (!response.ok) {
      throw new Error("随笔索引读取失败");
    }

    essayEntries = await response.json();
    renderEssayList(essayEntries);
  } catch (error) {
    const bundledEssays = getBundledEssays();

    if (bundledEssays.length > 0) {
      essayEntries = bundledEssays;
      renderEssayList(essayEntries);
      return;
    }

    const hint = getEssayLoadHint();
    essayList.innerHTML = `<div class="essay-empty">读取随笔列表失败：${escapeHtml(error.message)}${hint ? `<br>${escapeHtml(hint)}` : ""}</div>`;
    essayViewer.innerHTML = '<div class="essay-empty">请确认 essays/index.json 和对应 md 文件存在。</div>';
  }
}

function updateThemeUI() {
  const isDay = body.classList.contains("day");
  themeToggle.setAttribute("aria-label", isDay ? "切换到夜晚模式" : "切换到白天模式");
  chartTitle.textContent = isDay ? "🏃 30天冒险步数" : "⛏️ 30天探索里程";
  footer.textContent = isDay ? "【城堡旗帜已升起，欢迎来到我的像素世界】" : "【夜色告示牌：今晚也继续采集灵感】";
}

function stopCurrentGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (typeof activeCleanup === "function") {
    activeCleanup();
    activeCleanup = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function openGameOverlay() {
  gameOverlay.classList.add("active");
  gameOverlay.setAttribute("aria-hidden", "false");
  closeGame.focus();
}

function closeGameOverlay() {
  stopCurrentGame();
  gameOverlay.classList.remove("active");
  gameOverlay.setAttribute("aria-hidden", "true");
}

function getCanvasSize() {
  return {
    width: window.innerWidth - 60,
    height: window.innerHeight - 60
  };
}

function resizeCanvas() {
  const { width, height } = getCanvasSize();
  canvas.width = Math.max(width, 320);
  canvas.height = Math.max(height, 320);
}

function drawPixelRect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawDaySky(width, height, frameCount) {
  ctx.fillStyle = "#8fd2ff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  const cloudOffset = (frameCount * 0.25) % (width + 120);
  const clouds = [
    { x: width - cloudOffset, y: 48, scale: 1 },
    { x: width - cloudOffset + 220, y: 90, scale: 0.8 },
    { x: width - cloudOffset - 280, y: 120, scale: 1.1 }
  ];

  clouds.forEach((cloud) => {
    drawPixelRect(cloud.x, cloud.y, 60 * cloud.scale, 20 * cloud.scale, "#ffffff");
    drawPixelRect(cloud.x + 12 * cloud.scale, cloud.y - 12 * cloud.scale, 24 * cloud.scale, 12 * cloud.scale, "#ffffff");
    drawPixelRect(cloud.x + 34 * cloud.scale, cloud.y - 8 * cloud.scale, 20 * cloud.scale, 10 * cloud.scale, "#ffffff");
  });
}

function drawNightGrid(width, height) {
  ctx.fillStyle = "#13203b";
  ctx.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 24) {
    for (let y = 0; y < height; y += 24) {
      ctx.fillStyle = (Math.floor(x / 24) + Math.floor(y / 24)) % 2 === 0 ? "#1a2c18" : "#20301d";
      ctx.fillRect(x, y + height * 0.36, 24, 24);
      ctx.strokeStyle = "rgba(77, 92, 74, 0.18)";
      ctx.strokeRect(x, y, 24, 24);
    }
  }

  const stars = [
    [40, 40], [140, 90], [240, 40], [360, 70], [width - 110, 56], [width - 210, 108]
  ];
  stars.forEach(([x, y]) => drawPixelRect(x, y, 4, 4, "#f1efb7"));

  for (let x = 0; x < width; x += 24) {
    drawPixelRect(x, height * 0.68, 24, 8, "#6fa34e");
    drawPixelRect(x, height * 0.76, 24, 16, (x / 24) % 2 === 0 ? "#6d5338" : "#5d4631");
    drawPixelRect(x, height * 0.92, 24, 16, (x / 24) % 2 === 0 ? "#4b3b2a" : "#563f2b");
  }

  const oreSpots = [
    [width * 0.18, height * 0.84],
    [width * 0.52, height * 0.88],
    [width * 0.79, height * 0.8]
  ];

  oreSpots.forEach(([x, y]) => {
    drawPixelRect(x, y, 8, 8, "#8f948a");
    drawPixelRect(x + 8, y + 6, 6, 6, "#d3c86f");
  });
}

function startDinoGame() {
  resizeCanvas();
  let dinoY = canvas.height - 126;
  let velocityY = 0;
  let isJumping = false;
  let score = 0;
  const gravity = 0.9;
  let groundY = canvas.height - 126;
  const dino = { x: 92, width: 40, height: 48 };
  const obstacles = [];
  let frameCount = 0;

  function jumpHandler(event) {
    if (event.code === "Space" && !isJumping) {
      event.preventDefault();
      velocityY = -16;
      isJumping = true;
    }
  }

  function spawnObstacle() {
    const type = Math.random() > 0.5 ? "goomba" : "spike";
    obstacles.push({
      x: canvas.width + 20,
      y: groundY + 12,
      width: type === "goomba" ? 34 : 28,
      height: type === "goomba" ? 34 : 42,
      type
    });
  }

  function drawGround() {
    const baseY = groundY + dino.height;
    const brickWidth = 42;

    for (let i = 0; i < canvas.width / brickWidth + 1; i += 1) {
      const x = i * brickWidth;
      drawPixelRect(x, baseY, brickWidth - 2, 40, "#b86b2d");
      drawPixelRect(x, baseY, brickWidth - 2, 6, "#f0b56a");
      drawPixelRect(x, baseY + 18, brickWidth - 2, 4, "#8b4513");
      drawPixelRect(x + 18, baseY, 4, 40, "#8b4513");
    }
  }

  function drawDino(x, y) {
    drawPixelRect(x + 8, y + 6, 20, 24, "#049cd8");
    drawPixelRect(x + 18, y, 18, 14, "#049cd8");
    drawPixelRect(x + 26, y + 2, 10, 8, "#e60012");
    drawPixelRect(x + 26, y + 10, 8, 6, "#fbd000");
    drawPixelRect(x + 8, y + 28, 8, 20, "#e60012");
    drawPixelRect(x + 22, y + 28, 8, 20, "#e60012");
    drawPixelRect(x + 28, y + 18, 6, 4, "#ffffff");
  }

  function drawObstacle(obstacle) {
    if (obstacle.type === "goomba") {
      drawPixelRect(obstacle.x, obstacle.y + 12, obstacle.width, 20, "#8b4513");
      drawPixelRect(obstacle.x + 4, obstacle.y + 4, obstacle.width - 8, 14, "#c96f2d");
      drawPixelRect(obstacle.x + 6, obstacle.y + 16, 6, 4, "#111111");
      drawPixelRect(obstacle.x + 20, obstacle.y + 16, 6, 4, "#111111");
    } else {
      drawPixelRect(obstacle.x + 8, obstacle.y - 12, 12, 12, "#43b047");
      drawPixelRect(obstacle.x + 4, obstacle.y, 20, 18, "#2f7a2e");
      drawPixelRect(obstacle.x, obstacle.y + 18, 28, 12, "#8b4513");
    }
  }

  function checkCollision(obstacle) {
    return (
      dino.x < obstacle.x + obstacle.width &&
      dino.x + dino.width > obstacle.x &&
      dinoY < obstacle.y + obstacle.height &&
      dinoY + dino.height > obstacle.y
    );
  }

  function gameLoop() {
    frameCount += 1;
    score += 1;
    drawDaySky(canvas.width, canvas.height, frameCount);

    if (frameCount % 95 === 0) {
      spawnObstacle();
    }

    velocityY += gravity;
    dinoY += velocityY;

    if (dinoY >= groundY) {
      dinoY = groundY;
      velocityY = 0;
      isJumping = false;
    }

    drawGround();
    drawDino(dino.x, dinoY);

    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      obstacle.x -= 6.6;
      drawObstacle(obstacle);

      if (checkCollision(obstacle)) {
        ctx.fillStyle = "#111111";
        ctx.fillRect(canvas.width / 2 - 180, 80, 360, 84);
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px 'Press Start 2P', monospace";
        ctx.fillText("游戏结束，按关闭退出", canvas.width / 2 - 145, 128);
        return;
      }

      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
      }
    }

    ctx.fillStyle = "#111111";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.fillText(`SCORE ${score}`, 24, 34);
    ctx.fillText("SPACE JUMP", 24, 62);
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  overlayResizeHandler = () => {
    resizeCanvas();
    groundY = canvas.height - 126;
    dinoY = Math.min(dinoY, groundY);
  };

  window.addEventListener("keydown", jumpHandler);
  window.addEventListener("resize", overlayResizeHandler);

  activeCleanup = () => {
    window.removeEventListener("keydown", jumpHandler);
    if (overlayResizeHandler) {
      window.removeEventListener("resize", overlayResizeHandler);
      overlayResizeHandler = null;
    }
  };

  gameLoop();
}

function startSnakeGame() {
  resizeCanvas();
  const gridSize = 24;
  let tileCountX = Math.floor(canvas.width / gridSize);
  let tileCountY = Math.floor(canvas.height / gridSize);
  let snake = [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 }
  ];
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let food = { x: 12, y: 10 };
  let score = 0;
  let lastTime = 0;
  const moveInterval = 120;
  let gameOver = false;
  const floatTexts = [];

  function placeFood() {
    let valid = false;
    while (!valid) {
      food = {
        x: Math.floor(Math.random() * tileCountX),
        y: Math.floor(Math.random() * tileCountY)
      };
      valid = !snake.some((segment) => segment.x === food.x && segment.y === food.y);
    }
  }

  function keyHandler(event) {
    if (event.key === "ArrowUp" && direction.y !== 1) {
      event.preventDefault();
      nextDirection = { x: 0, y: -1 };
    } else if (event.key === "ArrowDown" && direction.y !== -1) {
      event.preventDefault();
      nextDirection = { x: 0, y: 1 };
    } else if (event.key === "ArrowLeft" && direction.x !== 1) {
      event.preventDefault();
      nextDirection = { x: -1, y: 0 };
    } else if (event.key === "ArrowRight" && direction.x !== -1) {
      event.preventDefault();
      nextDirection = { x: 1, y: 0 };
    }
  }

  function step() {
    direction = nextDirection;
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    if (
      head.x < 0 ||
      head.x >= tileCountX ||
      head.y < 0 ||
      head.y >= tileCountY ||
      snake.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      gameOver = true;
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      floatTexts.push({ x: head.x * gridSize, y: head.y * gridSize, life: 24 });
      placeFood();
    } else {
      snake.pop();
    }
  }

  function drawApple() {
    const x = food.x * gridSize;
    const y = food.y * gridSize;
    drawPixelRect(x + 6, y + 6, 12, 12, "#bb2d26");
    drawPixelRect(x + 10, y + 2, 4, 6, "#5daa4f");
    drawPixelRect(x + 4, y + 10, 4, 4, "#f2e7a1");
  }

  function drawSnakeSegment(segment, index) {
    const x = segment.x * gridSize;
    const y = segment.y * gridSize;
    const base = index === 0 ? "#314735" : "#45654b";
    const light = index === 0 ? "#617c59" : "#678764";

    drawPixelRect(x + 1, y + 1, gridSize - 2, gridSize - 2, base);
    drawPixelRect(x + 3, y + 3, gridSize - 8, 6, light);
    drawPixelRect(x + 4, y + 12, gridSize - 10, 5, "#23312a");

    if (index === 0) {
      drawPixelRect(x + 5, y + 8, 4, 4, "#d9cf70");
      drawPixelRect(x + 15, y + 8, 4, 4, "#d9cf70");
    }
  }

  function drawFloatTexts() {
    ctx.fillStyle = "#d9cf70";
    ctx.font = "12px 'Press Start 2P', monospace";
    for (let i = floatTexts.length - 1; i >= 0; i -= 1) {
      const item = floatTexts[i];
      ctx.fillText("+1 XP", item.x, item.y - (24 - item.life));
      item.life -= 1;
      if (item.life <= 0) {
        floatTexts.splice(i, 1);
      }
    }
  }

  function draw() {
    drawNightGrid(canvas.width, canvas.height);

    snake.forEach((segment, index) => {
      drawSnakeSegment(segment, index);
    });

    drawApple();
    drawFloatTexts();

    ctx.fillStyle = "#eef6d8";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.fillText(`XP ${score}`, 24, 34);
    ctx.fillText("ARROW MOVE", 24, 62);

    if (gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(canvas.width / 2 - 180, 80, 360, 84);
      ctx.fillStyle = "#eef6d8";
      ctx.fillText("游戏结束，按关闭退出", canvas.width / 2 - 145, 128);
    }
  }

  overlayResizeHandler = () => {
    resizeCanvas();
    tileCountX = Math.floor(canvas.width / gridSize);
    tileCountY = Math.floor(canvas.height / gridSize);
  };

  function gameLoop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }

    if (!gameOver && timestamp - lastTime >= moveInterval) {
      step();
      lastTime = timestamp;
    }

    draw();

    if (!gameOver) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  window.addEventListener("keydown", keyHandler);
  window.addEventListener("resize", overlayResizeHandler);

  activeCleanup = () => {
    window.removeEventListener("keydown", keyHandler);
    if (overlayResizeHandler) {
      window.removeEventListener("resize", overlayResizeHandler);
      overlayResizeHandler = null;
    }
  };

  draw();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame(mode) {
  stopCurrentGame();
  if (!body.classList.contains(mode)) {
    body.classList.remove("day", "night");
    body.classList.add(mode);
    updateThemeUI();
  }

  openGameOverlay();

  if (mode === "day") {
    startDinoGame();
  } else {
    startSnakeGame();
  }
}

function spawnParticles() {
  if (particleThrottle) {
    return;
  }

  particleThrottle = true;
  const count = body.classList.contains("day") ? 4 : 5;

  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.left = `${12 + Math.random() * 76}%`;
    particle.style.top = `${20 + Math.random() * 60}%`;
    particle.style.animationDelay = `${i * 0.04}s`;
    particleLayer.appendChild(particle);
    window.setTimeout(() => particle.remove(), 1200);
  }

  window.setTimeout(() => {
    particleThrottle = false;
  }, 150);
}

themeToggle.addEventListener("click", () => {
  body.classList.toggle("day");
  body.classList.toggle("night");
  updateThemeUI();
});

dayCompanion.addEventListener("click", () => startGame("day"));
nightCompanion.addEventListener("click", () => startGame("night"));

closeGame.addEventListener("click", closeGameOverlay);
gameOverlay.addEventListener("click", (event) => {
  if (event.target === gameOverlay) {
    closeGameOverlay();
  }
});

closeEssay.addEventListener("click", closeEssayOverlay);
essayOverlay.addEventListener("click", (event) => {
  if (event.target === essayOverlay) {
    closeEssayOverlay();
  }
});

closePhoto.addEventListener("click", closePhotoOverlay);
photoOverlay.addEventListener("click", (event) => {
  if (event.target === photoOverlay) {
    closePhotoOverlay();
  }
});

window.addEventListener("scroll", spawnParticles, { passive: true });

renderStepsChart();
renderPhotoWall();
updateThemeUI();
loadEssays();
