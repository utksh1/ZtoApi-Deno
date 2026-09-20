// ==========================================================================
// ZaiProxy Documentation - Interactivity & Scrollspy (ui-ux-pro-max)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Theme Management
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;

  const savedTheme = localStorage.getItem("zaiproxy_theme") || "dark";
  if (savedTheme === "light") {
    body.classList.remove("dark-mode");
  } else {
    body.classList.add("dark-mode");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = body.classList.toggle("dark-mode");
      localStorage.setItem("zaiproxy_theme", isDark ? "dark" : "light");
    });
  }

  // Toast Notification
  const toast = document.getElementById("toastNotification");
  let toastTimer = null;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  // Dynamic Host Interpolation in code blocks
  const origin = globalThis.location.origin;
  document.querySelectorAll("pre code, code").forEach((el) => {
    if (el.innerHTML.includes("http://localhost:9090")) {
      el.innerHTML = el.innerHTML.replaceAll("http://localhost:9090", origin);
    }
  });

  // Copy buttons on code snippets
  const copyButtons = document.querySelectorAll(".btn-copy");
  copyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const codeEl = document.getElementById(targetId);
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.innerText).then(() => {
          showToast("Copied to clipboard!");
        });
      }
    });
  });

  // Scrollspy for Sidebar Links
  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  const sections = document.querySelectorAll(".doc-section");

  function onScroll() {
    const scrollPos = globalThis.scrollY + 100;
    let currentSectionId = "";

    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentSectionId = sec.getAttribute("id");
      }
    });

    if (currentSectionId) {
      sidebarLinks.forEach((link) => {
        if (link.getAttribute("href") === `#${currentSectionId}`) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });
    }
  }

  globalThis.addEventListener("scroll", onScroll, { passive: true });
});
