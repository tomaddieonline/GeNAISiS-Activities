let sessionId = null;
let items = [];
let index = 0;

const el = {
  img: document.getElementById("img"),
  caption: document.getElementById("caption"),
  microStatus: document.getElementById("microStatus"),
  microSession: document.getElementById("microSession"),
  pillProgress: document.getElementById("pillProgress"),
  skeleton: document.getElementById("skeleton"),
  frame: document.getElementById("frame"),
  toast: document.getElementById("toast"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
};

function nowMs(){ return Date.now(); }

function toast(msg){
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.toast.classList.remove("show"), 1000);
}

function setStatus(msg){
  if (el.microStatus) el.microStatus.textContent = msg;
}

function setProgress(){
  if (!el.pillProgress) return;
  el.pillProgress.textContent = `${Math.min(index+1, items.length)} / ${items.length}`;
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

function showSkeleton(show){
  if (!el.skeleton || !el.frame) return;
  el.skeleton.classList.toggle("hidden", !show);
  el.frame.classList.toggle("hidden", show);
}

function openOverlay(src){
  if (!src) return;
  const overlay = document.createElement("div");
  overlay.className = "imgOverlay";
  overlay.innerHTML = `<img alt="Full screen image" src="${src}">`;
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

async function logAction(action){
  const item = items[index];
  if (!item) return;

  try{
    await fetch("/api/image-sequence/submit", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        item_id: item.id,
        filename: item.filename,
        action: action,               // "next" | "prev" | "open" | "start"
        index: index,
        timestamp_ms: nowMs()
      })
    });
  }catch(e){
    // silent: viewer still works
  }
}

async function showCurrent(){
  setProgress();

  const item = items[index];
  if (!item){
    setStatus("No items found.");
    return;
  }

  const src = `/static/images/image_sequence/${encodeURIComponent(item.filename)}`;

  if (el.prevBtn) el.prevBtn.disabled = (index <= 0);
  if (el.nextBtn) el.nextBtn.disabled = (index >= items.length - 1);

  showSkeleton(true);
  setStatus("Loading…");

  try{
    await preload(src);
  }catch(e){
    showSkeleton(false);
    setStatus(`Failed to load: ${item.filename}`);
    toast("Image failed to load");
    return;
  }

  // swap image (keeps subtle transition if your CSS animates)
  const newImg = el.img.cloneNode();
  newImg.id = "img";
  newImg.alt = "Sequence image";
  newImg.src = src;
  el.img.replaceWith(newImg);
  el.img = newImg;

  // tap to zoom (overlay only on tap)
  el.img.addEventListener("click", async () => {
    await logAction("open");
    openOverlay(src);
  });

  // caption
  if (el.caption){
    const cap = (item.caption || "").trim();
    el.caption.textContent = cap ? `${cap} • ${item.id}` : `Item: ${item.id}`;
  }

  // preload next
  const next = items[index + 1];
  if (next){
    preload(`/static/images/image_sequence/${encodeURIComponent(next.filename)}`).catch(()=>{});
  }

  showSkeleton(false);
  setStatus("Ready. Tap image to zoom.");
}

async function goNext(){
  if (index >= items.length - 1) return;
  index += 1;
  await logAction("next");
  await showCurrent();
}

async function goPrev(){
  if (index <= 0) return;
  index -= 1;
  await logAction("prev");
  await showCurrent();
}

function bindUI(){
  if (el.nextBtn) el.nextBtn.addEventListener("click", goNext);
  if (el.prevBtn) el.prevBtn.addEventListener("click", goPrev);

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });
}

async function start(){
  bindUI();
  showSkeleton(true);
  setStatus("Starting…");

  try{
    const s = await fetchJSON("/api/image-sequence/session");
    sessionId = s.session_id;

    if (el.microSession){
      el.microSession.textContent = `Session: ${sessionId.slice(0,8)}…`;
    }

    items = await fetchJSON("/api/image-sequence/items");
    if (!Array.isArray(items) || items.length === 0){
      showSkeleton(false);
      setStatus("No images configured in data/image_sequence/items.json");
      return;
    }

    await logAction("start");
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
