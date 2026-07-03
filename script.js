const EXAM_SIZE = 70;
const PASS_COUNT = 42;
const STORAGE_KEY = "taxiQuizState.v1";
const META_KEY = "taxiQuizMeta.v1";

const $ = (id) => document.getElementById(id);
const els = {
  progressText: $("progressText"),
  correctCount: $("correctCount"),
  wrongCount: $("wrongCount"),
  scoreText: $("scoreText"),
  progressFill: $("progressFill"),
  questionNumber: $("questionNumber"),
  questionText: $("questionText"),
  options: $("options"),
  feedback: $("feedback"),
  passHint: $("passHint"),
  historyList: $("historyList"),
  importantBtn: $("importantBtn"),
  masteredBtn: $("masteredBtn"),
  hideMastered: $("hideMastered"),
  importantCount: $("importantCount"),
  wrongSavedCount: $("wrongSavedCount"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  newExam: $("newExam"),
  resumeExam: $("resumeExam"),
  reviewWrong: $("reviewWrong"),
  reviewImportant: $("reviewImportant"),
  resetProgress: $("resetProgress"),
  resultDialog: $("resultDialog"),
  resultBody: $("resultBody"),
  closeResult: $("closeResult"),
  retryWrongFromResult: $("retryWrongFromResult"),
  restartFromResult: $("restartFromResult"),
  searchToggle: $("searchToggle"),
  searchDialog: $("searchDialog"),
  closeSearch: $("closeSearch"),
  searchInput: $("searchInput"),
  searchResults: $("searchResults")
};

let meta = loadMeta();
let state = loadState() || createExam("normal");

function loadMeta() {
  const base = { important: [], mastered: [], wrongNotebook: [], hideMastered: false, questionQueue: [] };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(META_KEY)) };
  } catch {
    return base;
  }
}

function saveMeta() {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function unique(values) {
  return [...new Set(values)];
}

function questionById(id) {
  return QUESTIONS.find((q) => q.id === id);
}

function availableQuestions() {
  return QUESTIONS.filter((q) => !meta.hideMastered || !meta.mastered.includes(q.id));
}

function rebuildQuestionQueue() {
  meta.questionQueue = shuffle(availableQuestions().map((q) => q.id));
  saveMeta();
}

function drawQueuedQuestions() {
  const target = Math.min(EXAM_SIZE, availableQuestions().length);
  const picked = [];
  const pickedIds = new Set();

  while (picked.length < target) {
    if (!Array.isArray(meta.questionQueue) || !meta.questionQueue.length) rebuildQuestionQueue();
    const before = picked.length;

    while (meta.questionQueue.length && picked.length < target) {
      const id = meta.questionQueue.shift();
      const q = questionById(id);
      if (!q || pickedIds.has(id)) continue;
      if (meta.hideMastered && meta.mastered.includes(id)) continue;
      picked.push(q);
      pickedIds.add(id);
    }

    if (picked.length === before && availableQuestions().length <= pickedIds.size) break;
  }

  saveMeta();
  return picked;
}

function createExam(mode, ids = null) {
  const pool = ids ? ids.map(questionById).filter(Boolean) : null;
  const picked = ids ? shuffle(pool).slice(0, Math.min(EXAM_SIZE, pool.length)) : drawQueuedQuestions();
  return {
    mode,
    current: 0,
    items: picked.map((q) => ({
      id: q.id,
      order: shuffle([0, 1, 2, 3]),
      selected: null,
      correct: null,
      locked: false
    }))
  };
}

function startExam(mode, ids = null) {
  state = createExam(mode, ids);
  saveState();
  render();
}

function currentItem() {
  return state.items[state.current];
}

function currentQuestion() {
  return questionById(currentItem().id);
}

function answeredItems() {
  return state.items.filter((item) => item.locked);
}

function correctItems() {
  return answeredItems().filter((item) => item.correct);
}

function wrongItems() {
  return answeredItems().filter((item) => item.correct === false);
}

function score() {
  const done = answeredItems().length;
  return done ? Math.round((correctItems().length / done) * 100) : 0;
}

function passTarget() {
  return state.items.length === EXAM_SIZE ? PASS_COUNT : Math.ceil(state.items.length * 0.6);
}

function render() {
  if (!state.items.length) {
    els.questionText.textContent = "출제할 문제가 없습니다. 완벽 문제 숨기기를 끄거나 저장 기록을 초기화해 주세요.";
    els.options.innerHTML = "";
    return;
  }

  const item = currentItem();
  const q = currentQuestion();
  const done = answeredItems().length;

  els.progressText.textContent = `${done} / ${state.items.length}`;
  els.correctCount.textContent = correctItems().length;
  els.wrongCount.textContent = wrongItems().length;
  els.scoreText.textContent = `${score()}점`;
  els.progressFill.style.width = `${(done / state.items.length) * 100}%`;
  els.questionNumber.textContent = `${state.current + 1}번 / 원문 ${q.id}번`;
  els.questionText.textContent = q.question;
  els.importantBtn.textContent = meta.important.includes(q.id) ? "★ 중요" : "☆ 중요";
  els.importantBtn.classList.toggle("active", meta.important.includes(q.id));
  els.masteredBtn.textContent = meta.mastered.includes(q.id) ? "완벽 해제" : "완벽 체크";
  els.masteredBtn.classList.toggle("active", meta.mastered.includes(q.id));
  els.hideMastered.checked = meta.hideMastered;
  els.importantCount.textContent = meta.important.length;
  els.wrongSavedCount.textContent = meta.wrongNotebook.length;
  els.prevBtn.disabled = state.current === 0;
  els.nextBtn.disabled = !item.locked;
  els.nextBtn.textContent = state.current === state.items.length - 1 ? "결과 보기" : "다음 문제";

  renderOptions(item, q);
  renderFeedback(item, q);
  renderHistory();
  renderPassHint();
  saveState();
  saveMeta();
}

function renderOptions(item, q) {
  els.options.innerHTML = "";
  item.order.forEach((originalIndex, visibleIndex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.textContent = `${visibleIndex + 1}. ${q.options[originalIndex]}`;
    btn.disabled = item.locked;
    if (item.locked) {
      if (originalIndex === q.answer) btn.classList.add("correct");
      if (item.selected === originalIndex && originalIndex !== q.answer) btn.classList.add("wrong");
    }
    btn.addEventListener("click", () => chooseAnswer(originalIndex));
    els.options.appendChild(btn);
  });
}

function chooseAnswer(originalIndex) {
  const item = currentItem();
  if (item.locked) return;
  const q = currentQuestion();
  item.selected = originalIndex;
  item.correct = originalIndex === q.answer;
  item.locked = true;
  if (!item.correct) meta.wrongNotebook = unique([...meta.wrongNotebook, q.id]);
  render();
}

function renderFeedback(item, q) {
  if (!item.locked) {
    els.feedback.hidden = true;
    els.feedback.innerHTML = "";
    return;
  }
  const chosen = q.options[item.selected];
  const answer = q.options[q.answer];
  els.feedback.hidden = false;
  els.feedback.innerHTML = `<strong class="${item.correct ? "good" : "bad"}">${item.correct ? "정답입니다." : "오답입니다."}</strong><br>선택: ${escapeHtml(chosen)}<br>정답: ${escapeHtml(answer)}<hr>${escapeHtml(q.explanation)}`;
}

function renderPassHint() {
  const correct = correctItems().length;
  const done = answeredItems().length;
  const remaining = state.items.length - done;
  const possible = correct + remaining;
  const target = passTarget();
  els.passHint.className = "pass-hint";
  if (!done) {
    els.passHint.textContent = "아직 채점 전입니다.";
  } else if (correct >= target) {
    els.passHint.textContent = `현재 ${correct}개 정답으로 합격 기준을 넘었습니다.`;
    els.passHint.classList.add("pass");
  } else if (possible < target) {
    els.passHint.textContent = `남은 문제를 모두 맞혀도 ${target}개에 도달할 수 없습니다.`;
    els.passHint.classList.add("fail");
  } else {
    els.passHint.textContent = `합격까지 정답 ${target - correct}개가 더 필요합니다.`;
  }
}

function renderHistory() {
  els.historyList.innerHTML = "";
  state.items.forEach((item, index) => {
    if (!item.locked && index !== state.current) return;
    const q = questionById(item.id);
    const row = document.createElement("div");
    row.className = `history-item ${index === state.current ? "current" : ""}`;
    row.innerHTML = `<span>${index + 1}. ${escapeHtml(q.question.slice(0, 38))}${q.question.length > 38 ? "..." : ""}</span><small>${item.locked ? (item.correct ? "정답" : "오답") : "진행중"}</small>`;
    row.addEventListener("click", () => {
      state.current = index;
      render();
    });
    els.historyList.appendChild(row);
  });
}

function showResult() {
  const correct = correctItems().length;
  const wrong = wrongItems().length;
  const passed = correct >= passTarget();
  const missed = wrongItems().map((item) => questionById(item.id));
  els.resultBody.innerHTML = `<div class="result-summary">
    <div class="result-box"><span>결과</span><strong>${passed ? "합격" : "불합격"}</strong></div>
    <div class="result-box"><span>점수</span><strong>${Math.round((correct / state.items.length) * 100)}점</strong></div>
    <div class="result-box"><span>정답</span><strong>${correct}</strong></div>
    <div class="result-box"><span>오답</span><strong>${wrong}</strong></div>
  </div>
  <h3>틀린 문제</h3>
  <div class="missed-list">${missed.length ? missed.map((q) => `<div><strong>원문 ${q.id}번</strong><br>${escapeHtml(q.question)}<br><small>정답: ${escapeHtml(q.options[q.answer])}</small></div>`).join("") : "<p>틀린 문제가 없습니다.</p>"}</div>`;
  if (!els.resultDialog.open) els.resultDialog.showModal();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[ch]));
}

els.nextBtn.addEventListener("click", () => {
  if (state.current >= state.items.length - 1) showResult();
  else {
    state.current += 1;
    render();
  }
});
els.prevBtn.addEventListener("click", () => {
  if (state.current > 0) {
    state.current -= 1;
    render();
  }
});
els.importantBtn.addEventListener("click", () => {
  const id = currentQuestion().id;
  meta.important = meta.important.includes(id) ? meta.important.filter((x) => x !== id) : [...meta.important, id];
  render();
});
els.masteredBtn.addEventListener("click", () => {
  const id = currentQuestion().id;
  meta.mastered = meta.mastered.includes(id) ? meta.mastered.filter((x) => x !== id) : [...meta.mastered, id];
  render();
});
els.hideMastered.addEventListener("change", () => {
  meta.hideMastered = els.hideMastered.checked;
  saveMeta();
});
els.newExam.addEventListener("click", () => startExam("normal"));
els.resumeExam.addEventListener("click", () => {
  state = loadState() || createExam("normal");
  render();
});
els.reviewWrong.addEventListener("click", () => {
  if (meta.wrongNotebook.length) startExam("wrong", meta.wrongNotebook);
});
els.reviewImportant.addEventListener("click", () => {
  if (meta.important.length) startExam("important", meta.important);
});
els.resetProgress.addEventListener("click", () => {
  if (confirm("현재 진행 중인 시험만 초기화할까요? 중요/완벽/오답 기록은 유지됩니다.")) startExam("normal");
});
els.closeResult.addEventListener("click", () => els.resultDialog.close());
els.restartFromResult.addEventListener("click", () => {
  els.resultDialog.close();
  startExam("normal");
});
els.retryWrongFromResult.addEventListener("click", () => {
  els.resultDialog.close();
  const ids = wrongItems().map((item) => item.id);
  if (ids.length) startExam("wrong-now", ids);
});
els.searchToggle.addEventListener("click", () => {
  els.searchDialog.showModal();
  els.searchInput.focus();
  renderSearch();
});
els.closeSearch.addEventListener("click", () => els.searchDialog.close());
els.searchInput.addEventListener("input", renderSearch);

function renderSearch() {
  const term = els.searchInput.value.trim().toLowerCase();
  const results = term ? QUESTIONS.filter((q) => [q.question, q.explanation, ...q.options].join(" ").toLowerCase().includes(term)).slice(0, 60) : [];
  els.searchResults.innerHTML = results.length ? results.map((q) => `<div class="search-result"><strong>원문 ${q.id}번</strong><p>${escapeHtml(q.question)}</p><small>정답: ${escapeHtml(q.options[q.answer])}</small><br><button type="button" data-id="${q.id}" class="secondary">이 문제 풀기</button></div>`).join("") : `<p>${term ? "검색 결과가 없습니다." : "검색어를 입력하면 문제, 보기, 해설에서 찾아줍니다."}</p>`;
  els.searchResults.querySelectorAll("button[data-id]").forEach((btn) => btn.addEventListener("click", () => {
    els.searchDialog.close();
    startExam("search", [Number(btn.dataset.id)]);
  }));
}

render();






