let sessionId = null;
let images = [];
let index = 0;

let shownAtMs = null;
let score = 0;
let scoredCount = 0;
let canAnswer = false;
let awaitingNext = false;

/* ===== Reflection flow config =====
   Put these files in: app/static/images/bot_or_not/
   You can rename them, just update here.
*/
const reflectionSlides = [
  { title: "Reflection 1", file: "reflection_1.png" },
  { title: "Reflection 2", file: "reflection_2.png" },
  { title: "Reflection 3", file: "reflection_3.png" },
  { title: "Reflection 4", file: "reflection_4.png" },
];
let reflectIndex = 0;

const el = {
  img: document.getElementById("img"),
  caption: document.getElementById("caption"),
  microStatus: document.getElementById("microStatus"),
  microSession: document.getElementById("microSession"),
  pillProgress: document.getElementById("pillProgress"),
  pillScore: document.getElementById("pillScore"),
  progressFill: document.getElementById("progressFill"),
  skeleton: document.getElementById("skeleton"),
  frame: document.getElementById("frame"),
  toast: document.getElementById("toast"),

  endcard: document.getElementById("endcard"),
  endStats: document.getElementById("endStats"),
  restartBtn: document.getElementById("restartBtn"),
  reflectBtn: document.getElementById("reflectBtn"),

  skipBtn: document.getElementById("skipBtn"),
  nextBtn: document.getElementById("nextBtn"),
  buttons: Array.from(document.querySelectorAll("button[data-choice]")),

  badgeResult: document.getElementById("badgeResult"),
  badgeTruth: document.getElementById("badgeTruth"),
  yourChoice: document.getElementById("yourChoice"),
  rtMs: document.getElementById("rtMs"),
  sideSub: document.getElementById("sideSub"),
  explainImg: document.getElementById("explainImg"),

  // ✅ NEW: description under explanation image
  explainDesc: document.getElementById("explainDesc"),

  // views
  gameGrid: document.getElementById("gameGrid"),
  reflectionView: document.getElementById("reflectionView"),

  // reflection UI
  reflectTitle: document.getElementById("reflectTitle"),
  reflectSub: document.getElementById("reflectSub"),
  reflectImg: document.getElementById("reflectImg"),
  reflectNextBtn: document.getElementById("reflectNextBtn"),
  reflectBackBtn: document.getElementById("reflectBackBtn"),
};

function niceLabel(v){
  if (v === "child") return "Child";
  if (v === "pro") return "Professional artist";
  if (v === "ai") return "AI";
  if (v === "skip") return "Skipped";
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

function setStatus(msg){
  if (el.microStatus) el.microStatus.textContent = msg;
}

function setProgress(){
  if (el.pillProgress) el.pillProgress.textContent = `${Math.min(index+1, images.length)} / ${images.length}`;
  const pct = images.length ? (Math.min(index, images.length) / images.length) * 100 : 0;
  if (el.progressFill) el.progressFill.style.width = `${pct}%`;
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
  if (el.skipBtn) el.skipBtn.disabled = locked;
}

function showSkeleton(show){
  if (!el.skeleton || !el.frame) return;
  el.skeleton.classList.toggle("hidden", !show);
  el.frame.classList.toggle("hidden", show);
}

/* ===== Overlay zoom (used for question, explanation, reflection) ===== */
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
/* ==================================================================== */

function resetRightPanel(){
  if (el.badgeResult){
    el.badgeResult.classList.remove("ok","no");
    el.badgeResult.textContent = "—";
  }
  if (el.badgeTruth) el.badgeTruth.textContent = "Correct: —";
  if (el.yourChoice) el.yourChoice.textContent = "—";
  if (el.rtMs) el.rtMs.textContent = "—";
  if (el.sideSub) el.sideSub.textContent = "Make a choice to reveal the correct answer.";

  if (el.explainImg){
    el.explainImg.classList.add("hidden");
    el.explainImg.removeAttribute("src");
    el.explainImg.onclick = null;
  }

  // ✅ NEW: reset description box
  if (el.explainDesc){
    el.explainDesc.textContent = "—";
  }
}

function endGame(){
  lockChoices(true);
  if (el.nextBtn) el.nextBtn.disabled = true;
  if (el.skipBtn) el.skipBtn.disabled = true;

  if (el.endcard) el.endcard.classList.remove("hidden");

  const total = images.length;
  const scoredLine = (scoredCount > 0)
    ? `Accuracy: ${Math.round((score / scoredCount) * 100)}% (${score}/${scoredCount} scored images)`
    : `No ground-truth labels were provided (or everything was skipped), so accuracy wasn't calculated.`;

  if (el.endStats){
    el.endStats.innerHTML = `
      <div><b>Total images:</b> ${total}</div>
      <div><b>${scoredLine}</b></div>
      <div style="margin-top:6px;color:rgba(233,240,255,.6);">Responses saved to <code>data/bot_or_not/responses.jsonl</code></div>
    `;
  }

  toast("Finished ✅");
  setStatus("Finished.");
  if (el.pillProgress) el.pillProgress.textContent = `${total} / ${total}`;
  if (el.progressFill) el.progressFill.style.width = "100%";
}

async function showCurrent(){
  if (el.endcard) el.endcard.classList.add("hidden");
  setProgress();

  if (index >= images.length){
    endGame();
    return;
  }

  awaitingNext = false;
  if (el.nextBtn) el.nextBtn.disabled = true;

  const item = images[index];
  const src = `/static/images/bot_or_not/${encodeURIComponent(item.filename)}`;

  resetRightPanel();
  lockChoices(true);
  showSkeleton(true);
  setStatus("Loading image…");

  try{
    await preload(src);
  }catch(e){
    showSkeleton(false);
    setStatus(`Failed to load image: ${item.filename}`);
    toast("Image failed to load");
    lockChoices(false);
    return;
  }

  const newImg = el.img.cloneNode();
  newImg.id = "img";
  newImg.alt = "Guess the creator";
  newImg.src = src;

  // ✅ question zoom
  newImg.style.cursor = "zoom-in";
  newImg.addEventListener("click", () => openOverlay(src));

  el.img.replaceWith(newImg);
  el.img = newImg;

  if (el.caption) el.caption.textContent = `Image ID: ${item.id}`;
  shownAtMs = nowMs();

  const next = images[index+1];
  if (next){
    preload(`/static/images/bot_or_not/${encodeURIComponent(next.filename)}`).catch(()=>{});
  }

  showSkeleton(false);
  setStatus("Your turn.");
  lockChoices(false);
}

async function revealAndSave(choice){
  if (!canAnswer) return;

  lockChoices(true);

  const item = images[index];
  const answeredAt = nowMs();
  const rt = answeredAt - shownAtMs;

  const truth = item.truth ?? null;
  const isScorable = !!truth && (choice !== "skip");
  const isCorrect = isScorable ? (choice === truth) : null;

  if (el.badgeResult){
    el.badgeResult.classList.remove("ok","no");
    el.badgeResult.textContent =
      truth
        ? (choice === "skip" ? "Skipped → Revealed" : (isCorrect ? "Correct ✅" : "Wrong ❌"))
        : "Recorded";
    if (isCorrect === true) el.badgeResult.classList.add("ok");
    if (isCorrect === false) el.badgeResult.classList.add("no");
  }
  if (el.badgeTruth) el.badgeTruth.textContent = `Correct: ${niceLabel(truth)}`;
  if (el.yourChoice) el.yourChoice.textContent = niceLabel(choice);
  if (el.rtMs) el.rtMs.textContent = `${rt} ms`;
  if (el.sideSub) el.sideSub.textContent = "Review the explanation → click Next.";

  // explanation image
  if (el.explainImg){
    if (item.explain_image){
      const exSrc = `/static/images/bot_or_not/${encodeURIComponent(item.explain_image)}`;
      el.explainImg.src = exSrc;
      el.explainImg.classList.remove("hidden");
      el.explainImg.onclick = () => openOverlay(exSrc);
    } else {
      el.explainImg.classList.add("hidden");
      el.explainImg.removeAttribute("src");
      el.explainImg.onclick = null;
    }
  }

  // ✅ NEW: explanation description under the image
  // Prefer item.description; fallback to item.explain_desc; else "—"
  if (el.explainDesc){
    const desc = (item.description ?? item.explain_desc ?? "").toString().trim();
    el.explainDesc.textContent = desc ? desc : "—";
  }

  if (isScorable){
    scoredCount += 1;
    if (isCorrect) score += 1;
    setScorePill();
  }

  try{
    const res = await fetch("/api/bot-or-not/submit", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        image_id: item.id,
        filename: item.filename,
        truth: truth,
        explain_image: item.explain_image || "",
        // ✅ optional but useful for logs
        description: (item.description ?? "").toString(),
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
  toast(choice === "skip" ? "Revealed" : "Saved");
}

async function goNext(){
  if (!awaitingNext) return;
  index += 1;
  await showCurrent();
}

/* =========================
   Reflection Flow (2 pages)
   ========================= */
function showReflectionView(){
  if (!el.gameGrid || !el.reflectionView) return;
  el.gameGrid.classList.add("hidden");
  el.reflectionView.classList.remove("hidden");
}

function showGameEndView(){
  if (!el.gameGrid || !el.reflectionView) return;
  el.reflectionView.classList.add("hidden");
  el.gameGrid.classList.remove("hidden");
  if (el.endcard) el.endcard.classList.remove("hidden");
}

async function renderReflection(){
  const slide = reflectionSlides[reflectIndex];
  if (!slide) return;

  if (el.reflectTitle) el.reflectTitle.textContent = slide.title;
  if (el.reflectSub) el.reflectSub.textContent = "Tap the image to zoom full-screen. Use Next to continue.";

  const src = `/static/images/bot_or_not/${encodeURIComponent(slide.file)}`;

  try{
    await preload(src);
  }catch(e){
    toast("Reflection image missing");
    return;
  }

  if (el.reflectImg){
    el.reflectImg.src = src;
    el.reflectImg.onclick = () => openOverlay(src);
  }

  if (el.reflectNextBtn){
    el.reflectNextBtn.textContent = (reflectIndex === reflectionSlides.length - 1) ? "Finish →" : "Next →";
  }
}

async function startReflection(){
  reflectIndex = 0;
  showReflectionView();
  await renderReflection();
}

async function nextReflection(){
  if (reflectIndex < reflectionSlides.length - 1){
    reflectIndex += 1;
    await renderReflection();
  } else {
    window.location.href = "/";
  }
}
/* ========================= */

function bindUI(){
  el.buttons.forEach(btn => btn.addEventListener("click", () => revealAndSave(btn.dataset.choice)));
  if (el.skipBtn) el.skipBtn.addEventListener("click", () => revealAndSave("skip"));
  if (el.nextBtn) el.nextBtn.addEventListener("click", goNext);

  // reflect button
  if (el.reflectBtn) el.reflectBtn.addEventListener("click", startReflection);

  // reflection nav
  if (el.reflectNextBtn) el.reflectNextBtn.addEventListener("click", nextReflection);
  if (el.reflectBackBtn) el.reflectBackBtn.addEventListener("click", showGameEndView);

  window.addEventListener("keydown", (e) => {
    // Reflection mode shortcuts
    if (el.reflectionView && !el.reflectionView.classList.contains("hidden")){
      if (e.key === "Enter"){
        e.preventDefault();
        nextReflection();
      }
      if (e.key === "Escape"){
        showGameEndView();
      }
      return;
    }

    // Game mode shortcuts
    if (awaitingNext && e.key === "Enter"){
      e.preventDefault();
      goNext();
      return;
    }
    if (!canAnswer) return;
    if (e.key === "1") revealAndSave("child");
    if (e.key === "2") revealAndSave("pro");
    if (e.key === "3") revealAndSave("ai");
    if (e.key === "ArrowRight") revealAndSave("skip");
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
}

async function start(){
  bindUI();
  lockChoices(true);
  showSkeleton(true);
  setStatus("Starting…");
  setScorePill();

  try{
    const s = await fetchJSON("/api/bot-or-not/session");
    sessionId = s.session_id;
    if (el.microSession) el.microSession.textContent = `Session: ${sessionId.slice(0, 8)}…`;

    images = await fetchJSON("/api/bot-or-not/images");
    if (!Array.isArray(images) || images.length === 0){
      showSkeleton(false);
      setStatus("No images found.");
      return;
    }

    if (el.pillProgress) el.pillProgress.textContent = `0 / ${images.length}`;
    if (el.progressFill) el.progressFill.style.width = "0%";

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
