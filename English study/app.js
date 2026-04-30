const STORAGE_KEYS = {
  apiKey: "englishStudy.apiKey",
  provider: "englishStudy.provider",
  model: "englishStudy.model",
  fallback: "englishStudy.fallback",
  fallbackVersion: "englishStudy.fallbackVersion",
  history: "englishStudy.history"
};

const GEMINI_PRIMARY_MODEL = "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODELS = ["gemini-2.0-flash-lite", "gemini-2.0-flash"];
const LEGACY_GEMINI_MODELS = ["gemini-2.5-flash"];
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";
const FALLBACK_SETTING_VERSION = "2";
const MODEL_OPTIONS = {
  google: [
    ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"],
    ["gemini-2.0-flash-lite", "Gemini 2.0 Flash-Lite"],
    ["gemini-2.0-flash", "Gemini 2.0 Flash"],
    ["gemini-2.5-flash", "Gemini 2.5 Flash"]
  ],
  openai: [
    ["gpt-5-mini", "OpenAI GPT-5 Mini"]
  ]
};

const koreanInput = document.querySelector("#koreanInput");
const englishInput = document.querySelector("#englishInput");
const styleSelect = document.querySelector("#styleSelect");
const contextInput = document.querySelector("#contextInput");
const providerSelect = document.querySelector("#providerSelect");
const modelInput = document.querySelector("#modelInput");
const resultOutput = document.querySelector("#resultOutput");
const apiKeyInput = document.querySelector("#apiKeyInput");
const storageStatus = document.querySelector("#storageStatus");
const historyCount = document.querySelector("#historyCount");
const historyList = document.querySelector("#historyList");

const reviewButton = document.querySelector("#reviewButton");
const habitButton = document.querySelector("#habitButton");
const saveApiButton = document.querySelector("#saveApiButton");
const clearApiButton = document.querySelector("#clearApiButton");
const exportHistoryButton = document.querySelector("#exportHistoryButton");
const importHistoryButton = document.querySelector("#importHistoryButton");
const importHistoryInput = document.querySelector("#importHistoryInput");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const copyResultButton = document.querySelector("#copyResultButton");

function loadApiKey() {
  return localStorage.getItem(STORAGE_KEYS.apiKey) || "";
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(0, 80)));
  renderHistory();
}

function mergeHistory(currentHistory, importedHistory) {
  const seen = new Set();
  return [...importedHistory, ...currentHistory]
    .filter((item) => item && item.korean && item.english)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .filter((item) => {
      const key = [item.createdAt, item.korean, item.english].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function setBusy(isBusy) {
  reviewButton.disabled = isBusy;
  habitButton.disabled = isBusy;
  reviewButton.textContent = isBusy ? "검토 중" : "검토";
}

function updateStorageStatus() {
  const hasKey = Boolean(loadApiKey());
  const count = loadHistory().length;
  const provider = providerSelect.value === "openai" ? "OpenAI" : "Google";
  storageStatus.textContent = hasKey ? `${provider} API 저장됨 · ${count}개 학습` : `${provider} API 미설정 · ${count}개 학습`;
}

function renderModelOptions(selectedModel) {
  const provider = providerSelect.value;
  const options = MODEL_OPTIONS[provider] || MODEL_OPTIONS.google;
  const fallbackModel = provider === "openai" ? OPENAI_DEFAULT_MODEL : GEMINI_PRIMARY_MODEL;
  const nextSelectedModel = options.some(([value]) => value === selectedModel) ? selectedModel : fallbackModel;

  modelInput.innerHTML = "";
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    modelInput.appendChild(option);
  });
  modelInput.value = nextSelectedModel;
  localStorage.setItem(STORAGE_KEYS.model, nextSelectedModel);
}

function renderHistory() {
  const history = loadHistory();
  historyCount.textContent = `${history.length}개`;
  historyList.innerHTML = "";

  history.slice(0, 12).forEach((item) => {
    const li = document.createElement("li");
    const time = document.createElement("time");
    const korean = document.createElement("div");
    const english = document.createElement("div");
    const summary = document.createElement("div");

    time.textContent = new Date(item.createdAt).toLocaleString();
    korean.innerHTML = `<strong>한글 의도</strong>${escapeHtml(item.korean).slice(0, 260)}`;
    english.innerHTML = `<strong>내 영어</strong>${escapeHtml(item.english).slice(0, 260)}`;
    summary.innerHTML = `<strong>핵심 메모</strong>${escapeHtml(item.summary || "검토 결과 저장됨").slice(0, 320)}`;

    li.append(time, korean, english, summary);
    historyList.appendChild(li);
  });

  updateStorageStatus();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReviewPrompt() {
  const style = styleSelect.value;
  const styleLabel = {
    auto: "AI가 한글 의도와 영어 문장을 보고 상황, 상대방, 사용 환경을 자연스럽게 추론한다.",
    natural: "자연스럽고 어색하지 않은 표현을 우선한다.",
    native: "원어민이 실제로 쓸 법한 표현을 우선한다.",
    polite: "공손하고 부드러운 표현을 우선한다.",
    simple: "쉽고 간단하지만 자연스러운 표현을 우선한다."
  }[style];

  return [
    "당신은 한국어 화자의 영어 표현을 돕는 영어 코치입니다.",
    "사용자가 말하고 싶은 한국어 의도와 직접 작성한 영어를 비교하세요.",
    styleLabel,
    contextInput.value.trim() ? `사용자가 추가로 적은 상황 메모: ${contextInput.value.trim()}` : "상황 메모가 없으면 문맥에서 자동 판단하세요.",
    "",
    "응답 형식:",
    "1. 더 자연스러운 영어",
    "2. 왜 이렇게 고쳤는지",
    "3. 대안 표현 2개",
    "4. 오늘 기억할 습관 1개",
    "",
    `한국어 의도:\n${koreanInput.value.trim()}`,
    "",
    `사용자가 작성한 영어:\n${englishInput.value.trim()}`
  ].join("\n");
}

function buildHabitPrompt(history) {
  const compactHistory = history.slice(0, 30).map((item, index) => ({
    index: index + 1,
    korean: item.korean,
    english: item.english,
    aiFeedback: item.feedback
  }));

  return [
    "당신은 한국어 화자의 누적 영어 습관을 분석하는 영어 코치입니다.",
    "아래 학습 기록을 바탕으로 자주 반복되는 어색함, 문법 습관, 직역투, 더 자연스러운 표현 전략을 정리하세요.",
    "사용자가 부담 없이 바로 적용할 수 있게 짧고 구체적으로 알려주세요.",
    "",
    "응답 형식:",
    "1. 자주 보이는 습관",
    "2. 바로 고치면 좋은 표현 방식",
    "3. 다음 학습 때 의식할 체크리스트",
    "4. 추천 연습 문장 3개",
    "",
    JSON.stringify(compactHistory, null, 2)
  ].join("\n");
}

async function callAiApi(prompt) {
  return providerSelect.value === "openai" ? callOpenAI(prompt) : callGemini(prompt);
}

async function callOpenAI(prompt) {
  const apiKey = loadApiKey();
  const model = modelInput.value.trim() || OPENAI_DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("API 키를 먼저 저장해 주세요.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 요청 실패: ${response.status} ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  return data.output_text || extractOutputText(data) || "응답 텍스트를 찾지 못했습니다.";
}

async function callGemini(prompt) {
  const apiKey = loadApiKey();
  const primaryModel = modelInput.value.trim() || GEMINI_PRIMARY_MODEL;

  if (!apiKey) {
    throw new Error("API 키를 먼저 저장해 주세요.");
  }

  const modelsToTry = shouldUseGeminiFallback()
    ? [primaryModel, ...GEMINI_FALLBACK_MODELS.filter((model) => model !== primaryModel)]
    : [primaryModel];
  const errors = [];

  for (const model of modelsToTry) {
    const attempts = shouldUseGeminiFallback() && model === primaryModel ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const retryLabel = attempt > 1 ? ` 다시 시도 ${attempt}/${attempts}` : "";
        const modelLabel = model === primaryModel ? model : `${model} 대체 모델`;
        resultOutput.textContent = `Google Gemini(${modelLabel})로 검토 중입니다.${retryLabel}`;
        return await requestGeminiOnce(prompt, apiKey, model);
      } catch (error) {
        errors.push(error);

        if (!isRetryableGeminiError(error) || attempt === attempts) {
          break;
        }

        await delay(attempt === 1 ? 2000 : 5000);
      }
    }
  }

  throw buildGeminiFinalError(errors);
}

async function requestGeminiOnce(prompt, apiKey, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Google Gemini API 요청 실패: ${response.status} ${errorText.slice(0, 500)}`);
    error.status = response.status;
    error.body = errorText;
    throw error;
  }

  const data = await response.json();
  return extractGeminiText(data) || "응답 텍스트를 찾지 못했습니다.";
}

function shouldUseGeminiFallback() {
  return false;
}

function isRetryableGeminiError(error) {
  return error.status === 503 || error.message.includes("UNAVAILABLE");
}

function buildGeminiFinalError(errors) {
  const lastError = errors.at(-1);
  const hasUnavailable = errors.some((error) => error.status === 503 || error.message.includes("UNAVAILABLE"));
  const hasRateLimit = errors.some((error) => error.status === 429);

  if (hasUnavailable) {
    return new Error("Google Gemini 모델이 현재 혼잡합니다. 자동 재시도와 대체 모델까지 시도했지만 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }

  if (hasRateLimit) {
    return new Error("Google Gemini 요청 한도에 걸렸습니다. 자동 재시도는 중단했습니다. 잠시 후 다시 시도하거나 Google API 사용량 한도를 확인해 주세요.");
  }

  return lastError || new Error("Google Gemini API 요청에 실패했습니다.");
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function extractOutputText(data) {
  return data.output
    ?.flatMap((item) => item.content || [])
    ?.map((content) => content.text)
    ?.filter(Boolean)
    ?.join("\n");
}

function extractGeminiText(data) {
  return data.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    ?.map((part) => part.text)
    ?.filter(Boolean)
    ?.join("\n");
}

async function handleReview() {
  if (!koreanInput.value.trim() || !englishInput.value.trim()) {
    resultOutput.textContent = "한글 의도와 영어 문장을 모두 입력해 주세요.";
    return;
  }

  setBusy(true);
  resultOutput.textContent = "AI가 문맥과 표현을 검토하고 있습니다.";

  try {
    const feedback = await callAiApi(buildReviewPrompt());
    resultOutput.textContent = feedback;

    const history = loadHistory();
    history.unshift({
      createdAt: new Date().toISOString(),
      korean: koreanInput.value.trim(),
      english: englishInput.value.trim(),
      feedback,
      summary: feedback.split("\n").find((line) => line.trim()) || "검토 결과 저장됨"
    });
    saveHistory(history);
  } catch (error) {
    resultOutput.textContent = formatUserError(error);
  } finally {
    setBusy(false);
  }
}

async function handleHabitReview() {
  const history = loadHistory();

  if (history.length === 0) {
    resultOutput.textContent = "아직 누적된 학습 기록이 없습니다.";
    return;
  }

  setBusy(true);
  resultOutput.textContent = "누적 학습 기록을 분석하고 있습니다.";

  try {
    resultOutput.textContent = await callAiApi(buildHabitPrompt(history));
  } catch (error) {
    resultOutput.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function formatUserError(error) {
  const message = error.message || String(error);

  if (message.includes("API 키")) {
    return message;
  }

  if (message.includes("혼잡") || message.includes("요청 한도")) {
    return message;
  }

  if (providerSelect.value === "google") {
    return `${message}\n\nGoogle API 키와 모델 이름을 확인해 주세요. 일시적인 서버 문제라면 잠시 후 다시 시도하면 해결될 수 있습니다.`;
  }

  return `${message}\n\nOpenAI API 키와 모델 이름을 확인해 주세요. 브라우저 직접 호출이 차단되는 환경이라면 다음 단계에서 작은 로컬 프록시 서버를 붙여 해결할 수 있습니다.`;
}

saveApiButton.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    resultOutput.textContent = "저장할 API 키를 입력해 주세요.";
    return;
  }
  localStorage.setItem(STORAGE_KEYS.apiKey, key);
  localStorage.setItem(STORAGE_KEYS.provider, providerSelect.value);
  localStorage.setItem(STORAGE_KEYS.model, modelInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.fallback, "false");
  apiKeyInput.value = "";
  updateStorageStatus();
  resultOutput.textContent = "API 키를 이 브라우저에 저장했습니다.";
});

clearApiButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.apiKey);
  apiKeyInput.value = "";
  updateStorageStatus();
  resultOutput.textContent = "API 정보를 초기화했습니다.";
});

exportHistoryButton.addEventListener("click", () => {
  const history = loadHistory();
  const exportData = {
    exportedAt: new Date().toISOString(),
    app: "English Study Local",
    version: 1,
    provider: providerSelect.value,
    model: modelInput.value,
    history
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `english-study-history-${dateStamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  resultOutput.textContent = `학습기록 ${history.length}개를 내보냈습니다. API 키는 포함하지 않았습니다.`;
});

importHistoryButton.addEventListener("click", () => {
  importHistoryInput.click();
});

importHistoryInput.addEventListener("change", async () => {
  const file = importHistoryInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importedData = JSON.parse(text);
    const importedHistory = Array.isArray(importedData)
      ? importedData
      : importedData.history;

    if (!Array.isArray(importedHistory)) {
      throw new Error("가져올 학습기록을 찾지 못했습니다.");
    }

    const mergedHistory = mergeHistory(loadHistory(), importedHistory);
    saveHistory(mergedHistory);
    resultOutput.textContent = `학습기록 ${importedHistory.length}개를 가져왔습니다. 병합 후 ${mergedHistory.length}개가 저장되어 있습니다. API 키는 가져오지 않았습니다.`;
  } catch (error) {
    resultOutput.textContent = `학습기록 가져오기에 실패했습니다.\n${error.message}`;
  } finally {
    importHistoryInput.value = "";
  }
});

clearHistoryButton.addEventListener("click", () => {
  const ok = window.confirm("누적 학습 기록을 모두 삭제할까요?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEYS.history);
  renderHistory();
  resultOutput.textContent = "학습 정보를 초기화했습니다.";
});

copyResultButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(resultOutput.textContent);
  copyResultButton.textContent = "완료";
  window.setTimeout(() => {
    copyResultButton.textContent = "복사";
  }, 1100);
});

reviewButton.addEventListener("click", handleReview);
habitButton.addEventListener("click", handleHabitReview);
providerSelect.addEventListener("change", () => {
  const defaultModel = providerSelect.value === "openai" ? OPENAI_DEFAULT_MODEL : GEMINI_PRIMARY_MODEL;
  renderModelOptions(defaultModel);
  localStorage.setItem(STORAGE_KEYS.provider, providerSelect.value);
  localStorage.setItem(STORAGE_KEYS.model, modelInput.value.trim());
  updateStorageStatus();
});
modelInput.addEventListener("change", () => {
  localStorage.setItem(STORAGE_KEYS.model, modelInput.value.trim());
});
providerSelect.value = localStorage.getItem(STORAGE_KEYS.provider) || "google";
renderModelOptions(localStorage.getItem(STORAGE_KEYS.model) || (providerSelect.value === "openai" ? OPENAI_DEFAULT_MODEL : GEMINI_PRIMARY_MODEL));
if (providerSelect.value === "google" && LEGACY_GEMINI_MODELS.includes(modelInput.value)) {
  modelInput.value = GEMINI_PRIMARY_MODEL;
  localStorage.setItem(STORAGE_KEYS.model, GEMINI_PRIMARY_MODEL);
}
if (localStorage.getItem(STORAGE_KEYS.fallbackVersion) !== FALLBACK_SETTING_VERSION) {
  localStorage.setItem(STORAGE_KEYS.fallback, "false");
  localStorage.setItem(STORAGE_KEYS.fallbackVersion, FALLBACK_SETTING_VERSION);
}
renderHistory();
