/**
 * Nocturne Games PWA bootstrap (ES Module).
 * Registers root service-worker.js via import.meta.url (shared/ → ../).
 */

const swUrl = new URL("../service-worker.js", import.meta.url);

function ensureStyles() {
  if (document.getElementById("nocturnePwaStyles")) return;
  const style = document.createElement("style");
  style.id = "nocturnePwaStyles";
  style.textContent = `
    .nocturne-update-bar{
      position:sticky;top:0;z-index:10000;display:flex;align-items:center;justify-content:center;
      gap:12px;flex-wrap:wrap;padding:8px 12px;
      background:rgba(8,17,31,.94);border-bottom:1px solid rgba(255,255,255,.14);
      color:#f4f7ff;font:650 14px/1.4 system-ui,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif
    }
    .nocturne-update-bar[hidden]{display:none!important}
    .nocturne-update-btn{
      border:0;border-radius:999px;padding:8px 14px;cursor:pointer;font:900 13px/1 inherit;
      color:#243015;background:linear-gradient(135deg,#f6e7b2,#efc768)
    }
    .nocturne-pwa-toast{
      position:fixed;left:50%;bottom:22px;z-index:10001;opacity:0;pointer-events:none;
      transform:translate(-50%,16px);padding:10px 16px;border-radius:999px;
      background:#071a13;color:#f5fff8;border:1px solid rgba(255,255,255,.12);
      font:650 14px/1.3 system-ui,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
      transition:.22s ease;max-width:min(92vw,420px);text-align:center
    }
    .nocturne-pwa-toast.show{opacity:1;transform:translate(-50%,0)}
  `;
  document.head.appendChild(style);
}

function ensureToastHost() {
  ensureStyles();
  let host = document.getElementById("nocturnePwaToast");
  if (host) return host;
  host = document.createElement("div");
  host.id = "nocturnePwaToast";
  host.className = "nocturne-pwa-toast";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

export function pwaToast(message) {
  const host = ensureToastHost();
  host.textContent = message;
  host.classList.add("show");
  clearTimeout(host._timer);
  host._timer = setTimeout(() => host.classList.remove("show"), 2200);
}

function ensureUpdateBar() {
  ensureStyles();
  let bar = document.getElementById("nocturneUpdateBar");
  if (bar) return bar;
  bar = document.createElement("div");
  bar.id = "nocturneUpdateBar";
  bar.className = "nocturne-update-bar";
  bar.hidden = true;
  bar.innerHTML = `
    <span class="nocturne-update-text">发现新版本，刷新后更新</span>
    <button type="button" class="nocturne-update-btn" id="nocturneUpdateBtn">刷新更新</button>
  `;
  document.body.prepend(bar);
  bar.querySelector("#nocturneUpdateBtn")?.addEventListener("click", () => {
    location.reload();
  });
  return bar;
}

function showUpdateBar() {
  const bar = ensureUpdateBar();
  bar.hidden = false;
  pwaToast("发现新版本，刷新后更新");
}

function wireConnectivity() {
  window.addEventListener("offline", () => pwaToast("当前为离线模式"));
  window.addEventListener("online", () => pwaToast("网络已恢复"));
  if (!navigator.onLine) {
    setTimeout(() => pwaToast("当前为离线模式"), 400);
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register(swUrl);

    if (registration.waiting) {
      showUpdateBar();
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBar();
        }
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) registration.update().catch(() => {});
    });
  } catch (error) {
    console.warn("[Nocturne PWA] service worker register failed", error);
  }
}

wireConnectivity();
registerServiceWorker();
