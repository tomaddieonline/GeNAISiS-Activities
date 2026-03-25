(function () {
  // Run only after DOM is ready (prevents "null" elements)
  function onReady(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(() => {
    const intro1 = document.getElementById("intro1");
    const intro2 = document.getElementById("intro2");

    const nextBtn = document.getElementById("introNextBtn");
    const backBtn = document.getElementById("introBackBtn");

    const img1 = document.getElementById("introImg1");
    const img2 = document.getElementById("introImg2");

    if (!intro1 || !intro2) {
      console.error("Intro sections not found (#intro1 / #intro2).");
      return;
    }

    function openOverlay(src){
      if (!src) return;

      const overlay = document.createElement("div");
      overlay.className = "imgOverlay";
      overlay.innerHTML = `<img alt="Full screen intro" src="${src}">`;
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

    function showIntroPage(page){
      if (page === 1){
        intro1.classList.remove("hidden");
        intro2.classList.add("hidden");
      } else {
        intro1.classList.add("hidden");
        intro2.classList.remove("hidden");
      }
    }

    // Default view
    showIntroPage(1);

    // Zoom on tap/click
    if (img1) img1.addEventListener("click", () => openOverlay(img1.getAttribute("src")));
    if (img2) img2.addEventListener("click", () => openOverlay(img2.getAttribute("src")));

    // ✅ Next/Back handlers (prevent default just in case)
    if (nextBtn){
      nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showIntroPage(2);
      });
    } else {
      console.error("Next button not found (#introNextBtn).");
    }

    if (backBtn){
      backBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showIntroPage(1);
      });
    }

    // Optional keyboard support
    window.addEventListener("keydown", (e) => {
      const onPage1 = !intro1.classList.contains("hidden");
      const onPage2 = !intro2.classList.contains("hidden");

      if (e.key === "Enter" && onPage1){
        e.preventDefault();
        showIntroPage(2);
      }
      if ((e.key === "ArrowLeft" || e.key === "Backspace") && onPage2){
        e.preventDefault();
        showIntroPage(1);
      }
    });
  });
})();
