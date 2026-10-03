(() => {
  "use strict";

  const STORAGE_KEY = "t03-card-studio.templates.v1";
  const HISTORY_KEY = "t03-card-studio.history.v1";

  const RATIO_CONFIG = {
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
    "9:16": { width: 1080, height: 1920 }
  };

  const els = {
    canvas: document.getElementById("previewCanvas"),
    canvasShell: document.getElementById("canvasShell"),
    imageInput: document.getElementById("imageInput"),
    dropZone: document.getElementById("dropZone"),
    fileMessage: document.getElementById("fileMessage"),
    captionInput: document.getElementById("captionInput"),
    xRange: document.getElementById("xRange"),
    yRange: document.getElementById("yRange"),
    sizeRange: document.getElementById("sizeRange"),
    colorInput: document.getElementById("colorInput"),
    xValue: document.getElementById("xValue"),
    yValue: document.getElementById("yValue"),
    sizeValue: document.getElementById("sizeValue"),
    ratioButtons: [...document.querySelectorAll(".ratio-btn")],
    previewMeta: document.getElementById("previewMeta"),
    downloadBtn: document.getElementById("downloadBtn"),
    downloadMessage: document.getElementById("downloadMessage"),
    resetBtn: document.getElementById("resetBtn"),
    rightsType: document.getElementById("rightsType"),
    externalRightsFields: document.getElementById("externalRightsFields"),
    sourceUrl: document.getElementById("sourceUrl"),
    licenseInfo: document.getElementById("licenseInfo"),
    rightsStatus: document.getElementById("rightsStatus"),
    templateName: document.getElementById("templateName"),
    createTemplateBtn: document.getElementById("createTemplateBtn"),
    updateTemplateBtn: document.getElementById("updateTemplateBtn"),
    templateMessage: document.getElementById("templateMessage"),
    templateList: document.getElementById("templateList"),
    templateCount: document.getElementById("templateCount"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    importJsonInput: document.getElementById("importJsonInput"),
    jsonMessage: document.getElementById("jsonMessage"),
    historyList: document.getElementById("historyList"),
    historyCount: document.getElementById("historyCount")
  };

  const ctx = els.canvas.getContext("2d", { alpha: true });

  const state = {
    ratio: "1:1",
    text: els.captionInput.value,
    x: 50,
    y: 18,
    fontSize: 64,
    color: "#ffffff",
    imageDataUrl: "",
    imageMime: "",
    imageName: "",
    imageObject: null,
    rights: {
      type: "self",
      sourceUrl: "",
      licenseInfo: ""
    },
    selectedTemplateId: null
  };

  let templates = loadArray(STORAGE_KEY);
  let history = loadArray(HISTORY_KEY);

  function loadArray(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setMessage(el, text, type = "") {
    el.textContent = text;
    el.className = `message ${type}`.trim();
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeText(text) {
    return String(text ?? "");
  }

  function syncControlsFromState() {
    els.captionInput.value = state.text;
    els.xRange.value = state.x;
    els.yRange.value = state.y;
    els.sizeRange.value = state.fontSize;
    els.colorInput.value = state.color;
    els.xValue.value = `${state.x}%`;
    els.yValue.value = `${state.y}%`;
    els.sizeValue.value = `${state.fontSize}px`;
    els.rightsType.value = state.rights.type;
    els.sourceUrl.value = state.rights.sourceUrl || "";
    els.licenseInfo.value = state.rights.licenseInfo || "";
    els.externalRightsFields.hidden = state.rights.type !== "external";

    els.ratioButtons.forEach(btn => {
      const active = btn.dataset.ratio === state.ratio;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    updateRightsStatus();
  }

  function updateRightsStatus() {
    const ok = state.rights.type === "self" ||
      (state.rights.type === "external" &&
       isHttpUrl(state.rights.sourceUrl) &&
       state.rights.licenseInfo.trim().length > 0);

    els.rightsStatus.textContent = ok ? "기록 완료" : "기록 필요";
    els.rightsStatus.style.background = ok ? "#e3f0e7" : "#f1ddd4";
    els.rightsStatus.style.color = ok ? "#2f6c48" : "#783821";
    return ok;
  }

  function isHttpUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function applyRatio() {
    const { width, height } = RATIO_CONFIG[state.ratio];
    els.canvas.width = width;
    els.canvas.height = height;
    els.previewMeta.textContent = `${state.ratio} · ${width} × ${height}`;
    renderCanvas();
  }

  function drawCoverImage(img, cw, ch) {
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const sw = cw / scale;
    const sh = ch / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  function splitLongToken(token, maxWidth) {
    const chunks = [];
    let current = "";
    for (const char of [...token]) {
      const candidate = current + char;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        chunks.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function wrapParagraph(paragraph, maxWidth) {
    if (paragraph === "") return [""];
    const parts = paragraph.match(/\S+|\s+/g) || [paragraph];
    const lines = [];
    let line = "";

    for (const part of parts) {
      if (/^\s+$/.test(part)) {
        if (line && !line.endsWith(" ")) line += " ";
        continue;
      }

      const safeParts = ctx.measureText(part).width > maxWidth
        ? splitLongToken(part, maxWidth)
        : [part];

      for (const token of safeParts) {
        const candidate = line ? `${line}${line.endsWith(" ") ? "" : " "}${token}` : token;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line.trimEnd());
          line = token;
        } else {
          line = candidate;
        }
      }
    }

    if (line || lines.length === 0) lines.push(line.trimEnd());
    return lines;
  }

  function getWrappedLines(text, maxWidth) {
    const paragraphs = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
    return paragraphs.flatMap(p => wrapParagraph(p, maxWidth));
  }

  function renderCanvas() {
    const cw = els.canvas.width;
    const ch = els.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    if (state.imageObject) {
      drawCoverImage(state.imageObject, cw, ch);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, cw, ch);
      gradient.addColorStop(0, "#d7c0aa");
      gradient.addColorStop(1, "#7d8d8b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cw, ch);
    }

    if (!state.text) return;

    const baseScale = cw / 1080;
    const fontPx = Math.round(state.fontSize * baseScale);
    const lineHeight = Math.round(fontPx * 1.24);
    const margin = Math.round(cw * 0.055);
    const x = cw * state.x / 100;
    const y = ch * state.y / 100;
    const symmetricWidth = Math.max(80, 2 * Math.min(Math.max(0, x - margin), Math.max(0, cw - margin - x)));
    const maxWidth = Math.min(cw * 0.88, symmetricWidth);

    ctx.font = `700 ${fontPx}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = state.color;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,.38)";
    ctx.lineWidth = Math.max(2, Math.round(fontPx * 0.055));

    const lines = getWrappedLines(state.text, maxWidth);

    // 위치 슬라이더의 X/Y 값은 문구 블록의 '중심점'을 의미한다.
    // 따라서 50 / 50이면 여러 줄 문구를 포함한 전체 문구 블록이
    // 캔버스의 정확한 중앙에 오도록 시작 Y 좌표를 보정한다.
    const totalTextHeight = lines.length * lineHeight;
    const startY = y - totalTextHeight / 2;

    lines.forEach((line, index) => {
      const yy = startY + index * lineHeight;
      if (yy + lineHeight < 0 || yy > ch) return;
      ctx.strokeText(line, x, yy, maxWidth);
      ctx.fillText(line, x, yy, maxWidth);
    });
  }

  function validateImageFile(file) {
    if (!file) return { ok: false, reason: "파일을 선택해주세요." };
    const allowedMime = ["image/png", "image/jpeg"];
    const lower = file.name.toLowerCase();
    const extOk = lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    const mimeOk = allowedMime.includes(file.type);

    if (!extOk || !mimeOk) {
      return {
        ok: false,
        reason: "지원하지 않는 파일입니다. PNG 또는 JPEG 이미지를 선택해주세요."
      };
    }
    if (file.size > 12 * 1024 * 1024) {
      return {
        ok: false,
        reason: "파일이 너무 큽니다. 12MB 이하의 PNG 또는 JPEG 이미지를 선택해주세요."
      };
    }
    return { ok: true };
  }

  async function fileToSanitizedDataUrl(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      const maxSide = 1920;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const temp = document.createElement("canvas");
      temp.width = w;
      temp.height = h;
      const tctx = temp.getContext("2d", { alpha: true });
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(img, 0, 0, w, h);

      const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = temp.toDataURL(mime, mime === "image/jpeg" ? 0.88 : undefined);

      return { dataUrl, mime, width: w, height: h };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.src = src;
    });
  }

  async function handleImageFile(file) {
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setMessage(els.fileMessage, `${validation.reason} 기존 편집 내용은 그대로 유지됩니다.`, "error");
      els.imageInput.value = "";
      return;
    }

    try {
      // 중요: 새 파일을 완전히 읽고 검증한 뒤에만 state를 변경한다.
      const sanitized = await fileToSanitizedDataUrl(file);
      const loaded = await loadImage(sanitized.dataUrl);

      state.imageDataUrl = sanitized.dataUrl;
      state.imageMime = sanitized.mime;
      state.imageName = file.name;
      state.imageObject = loaded;
      renderCanvas();

      setMessage(
        els.fileMessage,
        `${file.name} 불러오기 완료 (${sanitized.width}×${sanitized.height}). 원본 메타데이터는 제거되어 편집에 사용됩니다.`,
        "success"
      );
    } catch {
      setMessage(els.fileMessage, "이미지를 읽을 수 없어 거부했다. 기존 편집 내용은 그대로 유지됩니다.", "error");
    } finally {
      els.imageInput.value = "";
    }
  }

  function currentTemplatePayload(id = uuid(), name = "") {
    return {
      id,
      name,
      version: 1,
      aspectRatio: state.ratio,
      text: state.text,
      x: Number(state.x),
      y: Number(state.y),
      fontSize: Number(state.fontSize),
      color: state.color,
      imageDataUrl: state.imageDataUrl,
      imageMime: state.imageMime,
      imageName: state.imageName,
      rights: {
        type: state.rights.type,
        sourceUrl: state.rights.sourceUrl,
        licenseInfo: state.rights.licenseInfo
      },
      updatedAt: new Date().toISOString()
    };
  }

  function validateTemplate(t) {
    if (!t || typeof t !== "object") return "템플릿 형식이 올바르지 않습니다.";
    const requiredStrings = ["id", "name", "aspectRatio", "text", "color", "imageDataUrl", "imageMime", "imageName", "updatedAt"];
    for (const key of requiredStrings) {
      if (typeof t[key] !== "string") return `필수 항목 '${key}'이 없거나 형식이 올바르지 않습니다.`;
    }
    if (!RATIO_CONFIG[t.aspectRatio]) return "지원하지 않는 화면비입니다.";
    if (![t.x, t.y, t.fontSize].every(Number.isFinite)) return "위치 또는 크기 값이 올바르지 않습니다.";
    if (t.x < 0 || t.x > 100 || t.y < 0 || t.y > 100 || t.fontSize < 1 || t.fontSize > 300) {
      return "위치 또는 크기 값이 허용 범위를 벗어났습니다.";
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(t.color)) return "색상 형식이 올바르지 않습니다.";
    if (t.imageDataUrl && !/^data:image\/(png|jpeg);base64,/.test(t.imageDataUrl)) {
      return "이미지 데이터가 PNG 또는 JPEG 형식이 아닙니다.";
    }
    if (!t.rights || typeof t.rights !== "object") return "이미지 사용 권한 정보가 없습니다.";
    if (!["self", "external"].includes(t.rights.type)) return "이미지 제작 구분이 올바르지 않습니다.";
    if (typeof t.rights.sourceUrl !== "string" || typeof t.rights.licenseInfo !== "string") {
      return "이미지 사용 권한 정보 형식이 올바르지 않습니다.";
    }
    return "";
  }

  function persistTemplates() {
    saveArray(STORAGE_KEY, templates);
    renderTemplateList();
  }

  function renderTemplateList() {
    els.templateCount.textContent = `${templates.length}개`;
    els.templateList.innerHTML = "";

    if (templates.length === 0) {
      els.templateList.innerHTML = `<div class="empty">없음</div>`;
      return;
    }

    const sorted = [...templates].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    for (const t of sorted) {
      const card = document.createElement("article");
      card.className = `template-card ${t.id === state.selectedTemplateId ? "selected" : ""}`;
      card.dataset.id = t.id;

      const top = document.createElement("div");
      top.className = "template-card-top";

      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = t.name;
      const meta = document.createElement("p");
      meta.textContent = `${t.aspectRatio} · ${new Date(t.updatedAt).toLocaleString()}`;
      info.append(title, meta);

      const idText = document.createElement("code");
      idText.textContent = t.id.slice(0, 8);

      top.append(info, idText);

      const preview = document.createElement("p");
      preview.textContent = t.text ? t.text.slice(0, 80) : "(빈 문구)";

      const actions = document.createElement("div");
      actions.className = "template-actions";

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.textContent = "불러오기";
      loadBtn.addEventListener("click", () => loadTemplate(t.id));

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.textContent = "수정 선택";
      selectBtn.addEventListener("click", () => selectTemplate(t.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "삭제";
      deleteBtn.addEventListener("click", () => deleteTemplate(t.id));

      actions.append(loadBtn, selectBtn, deleteBtn);
      card.append(top, preview, actions);
      els.templateList.append(card);
    }
  }

  async function applyTemplateToState(t) {
    const err = validateTemplate(t);
    if (err) throw new Error(err);

    const next = {
      ratio: t.aspectRatio,
      text: t.text,
      x: t.x,
      y: t.y,
      fontSize: t.fontSize,
      color: t.color,
      imageDataUrl: t.imageDataUrl,
      imageMime: t.imageMime,
      imageName: t.imageName,
      rights: {
        type: t.rights.type,
        sourceUrl: t.rights.sourceUrl,
        licenseInfo: t.rights.licenseInfo
      }
    };

    let loaded = null;
    if (next.imageDataUrl) loaded = await loadImage(next.imageDataUrl);

    Object.assign(state, next);
    state.imageObject = loaded;
    state.selectedTemplateId = t.id;
    syncControlsFromState();
    applyRatio();
  }

  async function loadTemplate(id) {
    const t = templates.find(item => item.id === id);
    if (!t) return;
    try {
      await applyTemplateToState(t);
      els.templateName.value = t.name;
      els.updateTemplateBtn.disabled = false;
      setMessage(els.templateMessage, `'${t.name}' 템플릿을 불러왔습니다.`, "success");
      renderTemplateList();
    } catch (e) {
      setMessage(els.templateMessage, `템플릿을 불러오지 못했습니다: ${e.message}`, "error");
    }
  }

  function selectTemplate(id) {
    const t = templates.find(item => item.id === id);
    if (!t) return;
    state.selectedTemplateId = id;
    els.templateName.value = t.name;
    els.updateTemplateBtn.disabled = false;
    setMessage(els.templateMessage, `'${t.name}'을(를) 수정 대상으로 선택했습니다.`);
    renderTemplateList();
  }

  function deleteTemplate(id) {
    const t = templates.find(item => item.id === id);
    if (!t) return;
    if (!confirm(`'${t.name}' 템플릿을 삭제하시겠습니까?`)) return;

    templates = templates.filter(item => item.id !== id);
    if (state.selectedTemplateId === id) {
      state.selectedTemplateId = null;
      els.updateTemplateBtn.disabled = true;
    }

    persistTemplates();
    setMessage(els.templateMessage, `'${t.name}' 템플릿을 삭제했습니다.`, "success");
  }

  function validateTemplateName() {
    const name = els.templateName.value.trim();
    if (!name) {
      setMessage(els.templateMessage, "템플릿 이름을 입력해주세요.", "error");
      return "";
    }
    return name;
  }

  function ensureStorageSave(nextTemplates) {
    const raw = JSON.stringify(nextTemplates);
    try {
      localStorage.setItem(STORAGE_KEY, raw);
      return true;
    } catch {
      setMessage(
        els.templateMessage,
        "브라우저 저장 공간이 부족합니다. 더 작은 이미지를 사용하거나 기존 템플릿을 삭제한 뒤 다시 시도해주세요.",
        "error"
      );
      return false;
    }
  }

  function createTemplate() {
    const name = validateTemplateName();
    if (!name) return;

    const t = currentTemplatePayload(uuid(), name);
    const err = validateTemplate(t);
    if (err) {
      setMessage(els.templateMessage, `저장할 수 없습니다: ${err}`, "error");
      return;
    }

    const nextTemplates = [...templates, t];
    if (!ensureStorageSave(nextTemplates)) return;
    templates = nextTemplates;

    state.selectedTemplateId = t.id;
    els.updateTemplateBtn.disabled = false;
    setMessage(els.templateMessage, `'${name}' 템플릿을 저장했습니다.`, "success");
    renderTemplateList();
  }

  function updateTemplate() {
    const id = state.selectedTemplateId;
    if (!id) {
      setMessage(els.templateMessage, "수정할 템플릿을 먼저 선택해주세요.", "error");
      return;
    }

    const index = templates.findIndex(item => item.id === id);
    if (index < 0) {
      setMessage(els.templateMessage, "수정할 템플릿을 찾지 못했습니다.", "error");
      return;
    }

    const name = validateTemplateName();
    if (!name) return;

    const replacement = currentTemplatePayload(id, name);
    const err = validateTemplate(replacement);
    if (err) {
      setMessage(els.templateMessage, `수정할 수 없습니다: ${err}`, "error");
      return;
    }

    const nextTemplates = templates.map(item => item.id === id ? replacement : item);
    if (!ensureStorageSave(nextTemplates)) return;
    templates = nextTemplates;

    setMessage(els.templateMessage, `'${name}' 템플릿을 수정했습니다.`, "success");
    renderTemplateList();
  }

  function exportTemplates() {
    const payload = {
      schema: "t03-card-studio.templates",
      version: 1,
      exportedAt: new Date().toISOString(),
      templates
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `t03-templates-${dateStamp()}.json`
    );
    setMessage(els.jsonMessage, `${templates.length}개 템플릿을 JSON으로 내보냈습니다.`, "success");
  }

  function validateImportPayload(parsed) {
    if (!parsed || typeof parsed !== "object") return "JSON 형식이 올바르지 않습니다.";
    if (parsed.schema !== "t03-card-studio.templates") return "지원하지 않는 JSON 형식입니다.";
    if (parsed.version !== 1) return "지원하지 않는 JSON 버전입니다.";
    if (!Array.isArray(parsed.templates)) return "필수 항목 'templates'가 없습니다.";

    const ids = new Set();
    for (let i = 0; i < parsed.templates.length; i++) {
      const t = parsed.templates[i];
      const err = validateTemplate(t);
      if (err) return `${i + 1}번째 템플릿 오류: ${err}`;
      if (ids.has(t.id)) return `${i + 1}번째 템플릿 ID가 중복되었습니다.`;
      ids.add(t.id);
    }
    return "";
  }

  async function importTemplates(file) {
    if (!file) return;

    let text;
    try {
      text = await file.text();
    } catch {
      setMessage(els.jsonMessage, "JSON 파일을 읽지 못했습니다. 기존 템플릿은 그대로 유지됩니다.", "error");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      setMessage(els.jsonMessage, "JSON 문법이 올바르지 않습니다. 기존 템플릿은 그대로 유지됩니다.", "error");
      return;
    }

    const validationError = validateImportPayload(parsed);
    if (validationError) {
      setMessage(els.jsonMessage, `${validationError} 기존 템플릿은 그대로 유지됩니다.`, "error");
      return;
    }

    // 중요: 모든 항목 검증이 끝난 이후에만 저장한다.
    const nextTemplates = parsed.templates;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTemplates));
    } catch {
      setMessage(els.jsonMessage, "저장 공간이 부족해 가져오지 못했다. 기존 템플릿은 그대로 유지됩니다.", "error");
      return;
    }

    templates = nextTemplates;
    state.selectedTemplateId = null;
    els.updateTemplateBtn.disabled = true;
    renderTemplateList();
    setMessage(els.jsonMessage, `${templates.length}개 템플릿을 불러왔습니다.`, "success");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function dateStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function downloadImage() {
    if (!state.imageObject) {
      setMessage(els.downloadMessage, "PNG 또는 JPEG 이미지를 먼저 불러와주세요.", "error");
      return;
    }
    if (!updateRightsStatus()) {
      setMessage(els.downloadMessage, "외부 이미지를 사용한 경우 원본 출처 URL과 사용 허가 근거를 입력해주세요.", "error");
      return;
    }

    renderCanvas();
    els.canvas.toBlob(blob => {
      if (!blob) {
        setMessage(els.downloadMessage, "PNG 생성에 실패했습니다. 다시 시도해주세요.", "error");
        return;
      }

      const filename = `card-${state.ratio.replace(":", "x")}-${dateStamp()}.png`;
      downloadBlob(blob, filename);
      addHistory(filename);
      setMessage(els.downloadMessage, `${filename} 저장을 시작했습니다.`, "success");
    }, "image/png");
  }

  function addHistory(filename) {
    const item = {
      id: uuid(),
      filename,
      createdAt: new Date().toISOString(),
      aspectRatio: state.ratio,
      text: state.text,
      rights: {
        type: state.rights.type,
        sourceUrl: state.rights.sourceUrl,
        licenseInfo: state.rights.licenseInfo
      }
    };
    history = [item, ...history].slice(0, 10);
    try {
      saveArray(HISTORY_KEY, history);
    } catch {
      // 기록 저장 실패가 이미지 다운로드 자체를 막지는 않는다.
    }
    renderHistory();
  }

  function renderHistory() {
    els.historyCount.textContent = `${history.length}건`;
    els.historyList.innerHTML = "";

    if (history.length === 0) {
      els.historyList.innerHTML = `<div class="empty">없음</div>`;
      return;
    }

    for (const h of history) {
      const card = document.createElement("article");
      card.className = "history-card";

      const top = document.createElement("div");
      top.className = "history-card-top";

      const title = document.createElement("strong");
      title.textContent = h.filename;
      const meta = document.createElement("span");
      meta.className = "badge";
      meta.textContent = h.aspectRatio;
      top.append(title, meta);

      const date = document.createElement("p");
      date.textContent = new Date(h.createdAt).toLocaleString();

      const caption = document.createElement("p");
      caption.textContent = `문구: ${h.text ? h.text.slice(0, 100) : "(빈 문구)"}`;

      const rights = document.createElement("p");
      rights.textContent = h.rights.type === "self"
        ? "권한: 본인 제작"
        : `권한: ${h.rights.licenseInfo} · ${h.rights.sourceUrl}`;

      card.append(top, date, caption, rights);
      els.historyList.append(card);
    }
  }

  function resetEditor() {
    state.ratio = "1:1";
    state.text = "오늘도 한 칸씩 앞으로";
    state.x = 50;
    state.y = 18;
    state.fontSize = 64;
    state.color = "#ffffff";
    state.imageDataUrl = "";
    state.imageMime = "";
    state.imageName = "";
    state.imageObject = null;
    state.rights = { type: "self", sourceUrl: "", licenseInfo: "" };
    state.selectedTemplateId = null;

    els.templateName.value = "";
    els.updateTemplateBtn.disabled = true;
    syncControlsFromState();
    applyRatio();
    setMessage(els.fileMessage, "");
    setMessage(els.downloadMessage, "");
    setMessage(els.templateMessage, "새 작업을 시작했습니다. 저장된 템플릿은 그대로 유지됩니다.");
    renderTemplateList();
  }

  els.imageInput.addEventListener("change", e => handleImageFile(e.target.files?.[0]));

  ["dragenter", "dragover"].forEach(type => {
    els.dropZone.addEventListener(type, e => {
      e.preventDefault();
      els.dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    els.dropZone.addEventListener(type, e => {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
    });
  });

  els.dropZone.addEventListener("drop", e => {
    handleImageFile(e.dataTransfer.files?.[0]);
  });

  els.dropZone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") els.imageInput.click();
  });

  els.captionInput.addEventListener("input", e => {
    state.text = e.target.value;
    renderCanvas();
  });

  els.xRange.addEventListener("input", e => {
    state.x = Number(e.target.value);
    els.xValue.value = `${state.x}%`;
    renderCanvas();
  });

  els.yRange.addEventListener("input", e => {
    state.y = Number(e.target.value);
    els.yValue.value = `${state.y}%`;
    renderCanvas();
  });

  els.sizeRange.addEventListener("input", e => {
    state.fontSize = Number(e.target.value);
    els.sizeValue.value = `${state.fontSize}px`;
    renderCanvas();
  });

  els.colorInput.addEventListener("input", e => {
    state.color = e.target.value;
    renderCanvas();
  });

  els.ratioButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.ratio = btn.dataset.ratio;
      syncControlsFromState();
      applyRatio();
    });
  });

  els.rightsType.addEventListener("change", e => {
    state.rights.type = e.target.value;
    els.externalRightsFields.hidden = state.rights.type !== "external";
    updateRightsStatus();
  });

  els.sourceUrl.addEventListener("input", e => {
    state.rights.sourceUrl = e.target.value.trim();
    updateRightsStatus();
  });

  els.licenseInfo.addEventListener("input", e => {
    state.rights.licenseInfo = e.target.value.trim();
    updateRightsStatus();
  });

  els.downloadBtn.addEventListener("click", downloadImage);
  els.resetBtn.addEventListener("click", resetEditor);
  els.createTemplateBtn.addEventListener("click", createTemplate);
  els.updateTemplateBtn.addEventListener("click", updateTemplate);
  els.exportJsonBtn.addEventListener("click", exportTemplates);

  els.importJsonInput.addEventListener("change", e => {
    importTemplates(e.target.files?.[0]);
    e.target.value = "";
  });

  syncControlsFromState();
  applyRatio();
  renderTemplateList();
  renderHistory();
})();
