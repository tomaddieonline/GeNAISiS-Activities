let sessionId = null;
let items = [];
let index = 0;

let shownAtMs = null;
let score = 0;
let scoredCount = 0;
let canAnswer = false;
let awaitingNext = false;

// ✅ Reflection sequence (3 pages)
const reflections = [
  "/static/images/phrase_completion/reflection_1.png",
  "/static/images/phrase_completion/reflection_2.png",
  "/static/images/phrase_completion/reflection_3.png",
];
let reflectIndex = 0;

const el = {
  // game
  gameView: document.getElementById("gameView"),
  img: document.getElementById("img"),
  caption: document.getElementById("caption"),
  microStatus: document.getElementById("microStatus"),
  pillProgress: document.getElementById("pillProgress"),
  pillScore: document.getElementById("pillScore"),
  skeleton: document.getElementById("skeleton"),
  frame: document.getElementById("frame"),
  toast: document.getElementById("toast"),
  nextBtn: document.getElementById("nextBtn"),
  restartBtn: document.getElementById("restartBtn"),
  endcard: document.getElementById("endcard"),
  endStats: document.getElementById("endStats"),
  toReflectBtn: document.getElementById("toReflectBtn"),
  buttons: Array.from(document.querySelectorAll("button[data-choice]")),

  badgeResult: document.getElementById("badgeResult"),
  badgeTruth: document.getElementById("badgeTruth"),
  yourChoice: document.getElementById("yourChoice"),
  rtMs: document.getElementById("rtMs"),
  explainImg: document.getElementById("explainImg"),
  notes: document.getElementById("notes"),

  // reflection
  reflectView: document.getElementById("reflectView"),
  reflectImg: document.getElementById("reflectImg"),
  reflectStatus: document.getElementById("reflectStatus"),
  reflectPrevBtn: document.getElementById("reflectPrevBtn"),
  reflectNextBtn: document.getElementById("reflectNextBtn"),
};

function niceLabel(v){
  if (v === "child") return "Child";
  if (v === "teacher") return "Teacher";
  if (v === "ai") return "AI";
  return v || "—";
}

function nowMs(){ return Date.now(); }

function toast(msg){
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.toast.classList.remove("show"), 1200);
}

/** Overlay opens ONLY on tap/click */
function openOverlay(src){
  if (!src) return;

  const overlay = document.createElement("div");
  overlay.className = "imgOverlay";
  overlay.innerHTML = `<img alt="Full screen" src="${src}">`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", close);

  window.addEventListener("keydown", function onKey(e){
    if (e.key === "Escape"){
      close();
      window.removeEventListener("keydown", onKey);
    }
  });
}

function setStatus(msg){
  if (el.microStatus) el.microStatus.textContent = msg;
}

function setProgress(){
  if (!el.pillProgress) return;
  el.pillProgress.textContent = `${Math.min(index+1, items.length)} / ${items.length}`;
}

function setScorePill(){
  if (!el.pillScore) return;
  el.pillScore.textContent = (scoredCount === 0) ? "Score: —" : `Score: ${score} / ${scoredCount}`;
}

async function fetchJSON(url){
  const r = await fetch(url, { headers: { "Accept":"application/json" }});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function preload(src){
  return new Promise((resolve, reject)=>{
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => reject(new Error("Failed preload"));
    im.src = src;
  });
}

function lockChoices(locked){
  canAnswer = !locked;
  el.buttons.forEach(b => b.disabled = locked);
}

function showSkeleton(show){
  if (!el.skeleton || !el.frame) return;
  el.skeleton.classList.toggle("hidden", !show);
  el.frame.classList.toggle("hidden", show);
}

function resetRightPanel(){
  if (el.badgeResult){
    el.badgeResult.classList.remove("ok","no");
    el.badgeResult.textContent = "—";
  }
  if (el.badgeTruth) el.badgeTruth.textContent = "Correct: —";
  if (el.yourChoice) el.yourChoice.textContent = "—";
  if (el.rtMs) el.rtMs.textContent = "—";

  if (el.explainImg){
    el.explainImg.classList.add("hidden");
    el.explainImg.removeAttribute("src");
  }
  if (el.notes) el.notes.textContent = "—";
}

function bindZoomForPromptImage(imgEl, src){
  if (!imgEl) return;
  imgEl.style.cursor = "zoom-in";
  imgEl.onclick = () => openOverlay(src);
}

function bindZoomForExplainImage(){
  if (!el.explainImg) return;
  el.explainImg.onclick = () => {
    if (el.explainImg.classList.contains("hidden")) return;
    const src = el.explainImg.getAttribute("src");
    openOverlay(src);
  };
}

/* ---------------------------
   Reflection flow
----------------------------*/
async function showReflection(){
  // switch views
  if (el.gameView) el.gameView.classList.add("hidden");
  if (el.reflectView) el.reflectView.classList.remove("hidden");

  const src = reflections[reflectIndex];
  if (!el.reflectImg) return;

  // preload for smoothness
  try { await preload(src); } catch(e){}

  el.reflectImg.src = src;
  el.reflectImg.style.cursor = "zoom-in";
  el.reflectImg.onclick = () => openOverlay(src);

  if (el.reflectStatus){
    el.reflectStatus.textContent = `Page ${reflectIndex + 1} of ${reflections.length}`;
  }

  if (el.reflectPrevBtn) el.reflectPrevBtn.disabled = (reflectIndex === 0);
  if (el.reflectNextBtn){
    el.reflectNextBtn.textContent = (reflectIndex === reflections.length - 1) ? "Finish →" : "Next →";
  }
}

function goReflectNext(){
  if (reflectIndex < reflections.length - 1){
    reflectIndex += 1;
    showReflection();
  } else {
    // finished reflections
    window.location.href = "/";
  }
}

function goReflectPrev(){
  if (reflectIndex > 0){
    reflectIndex -= 1;
    showReflection();
  }
}

/* ---------------------------
   End game
----------------------------*/
function endGame(){
  lockChoices(true);
  if (el.nextBtn) el.nextBtn.disabled = true;

  if (el.endcard) el.endcard.classList.remove("hidden");
  const total = items.length;
  const line = (scoredCount > 0)
    ? `Accuracy: ${Math.round((score/scoredCount)*100)}% (${score}/${scoredCount})`
    : `No labels found.`;

  if (el.endStats){
    el.endStats.innerHTML = `
      <div><b>Total:</b> ${total}</div>
      <div><b>${line}</b></div>
      <div style="margin-top:6px; color: rgba(233,240,255,.6);">
        Saved to <code>data/phrase_completion/responses.jsonl</code>
      </div>
    `;
  }

  toast("Finished ✅");
  setStatus("Finished.");
}

/* ---------------------------
   Game flow
----------------------------*/
async function showCurrent(){
  if (el.endcard) el.endcard.classList.add("hidden");
  setProgress();

  if (index >= items.length){
    endGame();
    return;
  }

  awaitingNext = false;
  if (el.nextBtn) el.nextBtn.disabled = true;

  const item = items[index];
  const src = `/static/images/phrase_completion/${encodeURIComponent(item.prompt_image)}`;

  resetRightPanel();
  lockChoices(true);
  showSkeleton(true);
  setStatus("Loading…");

  try{
    await preload(src);
  }catch(e){
    showSkeleton(false);
    setStatus(`Failed to load: ${item.prompt_image}`);
    toast("Prompt image failed");
    lockChoices(false);
    return;
  }

  // replace prompt image element
  const newImg = el.img.cloneNode();
  newImg.id = "img";
  newImg.alt = "Prompt";
  newImg.src = src;
  el.img.replaceWith(newImg);
  el.img = newImg;

  bindZoomForPromptImage(el.img, src);

  if (el.caption) el.caption.textContent = `Item: ${item.id}`;
  shownAtMs = nowMs();

  const next = items[index+1];
  if (next){
    preload(`/static/images/phrase_completion/${encodeURIComponent(next.prompt_image)}`).catch(()=>{});
  }

  showSkeleton(false);
  setStatus("Your turn.");
  lockChoices(false);
}

async function revealAndSave(choice){
  if (!canAnswer) return;

  lockChoices(true);

  const item = items[index];
  const answeredAt = nowMs();
  const rt = answeredAt - shownAtMs;

  const truth = item.truth ?? null;
  const isCorrect = truth ? (choice === truth) : null;

  if (el.badgeResult){
    el.badgeResult.classList.remove("ok","no");
    el.badgeResult.textContent = (isCorrect === true) ? "Correct ✅" : "Wrong ❌";
    if (isCorrect === true) el.badgeResult.classList.add("ok");
    if (isCorrect === false) el.badgeResult.classList.add("no");
  }
  if (el.badgeTruth) el.badgeTruth.textContent = `Correct: ${niceLabel(truth)}`;
  if (el.yourChoice) el.yourChoice.textContent = niceLabel(choice);
  if (el.rtMs) el.rtMs.textContent = `${rt} ms`;

  // explanation image (tap to zoom)
  if (el.explainImg){
    if (item.explain_image){
      const exSrc = `/static/images/phrase_completion/${encodeURIComponent(item.explain_image)}`;
      el.explainImg.src = exSrc;
      el.explainImg.classList.remove("hidden");
    } else {
      el.explainImg.classList.add("hidden");
      el.explainImg.removeAttribute("src");
    }
  }

  if (el.notes) el.notes.textContent = (item.notes || "—");

  if (truth){
    scoredCount += 1;
    if (choice === truth) score += 1;
    setScorePill();
  }

  try{
    const res = await fetch("/api/phrase/submit", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        item_id: item.id,
        prompt_image: item.prompt_image,
        truth: truth,
        explain_image: item.explain_image || "",
        notes: item.notes || "",
        choice,
        shown_at_ms: shownAtMs,
        answered_at_ms: answeredAt,
        rt_ms: rt,
        index
      })
    });
    if (!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }catch(e){
    toast("Save failed");
    setStatus("Save failed (server).");
    lockChoices(false);
    return;
  }

  awaitingNext = true;
  if (el.nextBtn) el.nextBtn.disabled = false;
  setStatus("Review → click Next.");
  toast(isCorrect ? "Nice!" : "Recorded");
}

async function goNext(){
  if (!awaitingNext) return;
  index += 1;
  await showCurrent();
}

function bindUI(){
  el.buttons.forEach(b => b.addEventListener("click", () => revealAndSave(b.dataset.choice)));
  if (el.nextBtn) el.nextBtn.addEventListener("click", goNext);

  window.addEventListener("keydown", (e) => {
    // reflection keyboard
    if (el.reflectView && !el.reflectView.classList.contains("hidden")){
      if (e.key === "ArrowRight") goReflectNext();
      if (e.key === "ArrowLeft") goReflectPrev();
      if (e.key === "Escape") return;
      return;
    }

    // game keyboard
    if (awaitingNext && e.key === "Enter"){
      e.preventDefault();
      goNext();
      return;
    }
    if (!canAnswer) return;
    if (e.key === "1") revealAndSave("child");
    if (e.key === "2") revealAndSave("teacher");
    if (e.key === "3") revealAndSave("ai");
  });

  if (el.restartBtn){
    el.restartBtn.addEventListener("click", async () => {
      score = 0; scoredCount = 0;
      setScorePill();
      index = 0;
      toast("Restarted");
      await showCurrent();
    });
  }

  bindZoomForExplainImage();

  // ✅ endcard → reflections
  if (el.toReflectBtn){
    el.toReflectBtn.addEventListener("click", async () => {
      reflectIndex = 0;
      await showReflection();
    });
  }

  // reflection buttons
  if (el.reflectPrevBtn) el.reflectPrevBtn.addEventListener("click", goReflectPrev);
  if (el.reflectNextBtn) el.reflectNextBtn.addEventListener("click", goReflectNext);
}

async function start(){
  bindUI();
  lockChoices(true);
  showSkeleton(true);
  setStatus("Starting…");
  setScorePill();

  try{
    const s = await fetchJSON("/api/phrase/session");
    sessionId = s.session_id;

    items = await fetchJSON("/api/phrase/items");

    if (el.pillProgress) el.pillProgress.textContent = `0 / ${items.length}`;
    toast("Ready");
    await showCurrent();
  }catch(e){
    showSkeleton(false);
    setStatus("Failed to start. Is Flask running?");
    toast("Startup failed");
    console.error(e);
  }
}

start();
