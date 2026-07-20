/**
 * 统一顶栏：标题 / 返回 + 工具栏（声音 · 全屏 · 设置）
 * 大厅与各游戏共用，避免按钮散落。
 */
import {getSetting,updateSettings,subscribe} from "./settings.js";
import {setupFullscreenButton} from "./fullscreen.js";

function resolveEl(target){
  if(typeof target==="string")return document.querySelector(target);
  return target||null;
}

function soundOn(){
  return getSetting("common.soundEnabled")!==false;
}

function syncSoundButton(btn){
  if(!btn)return;
  const on=soundOn();
  btn.dataset.soundOn=on?"1":"0";
  btn.setAttribute("aria-pressed",on?"true":"false");
  btn.textContent=on?"🔊":"🔇";
  btn.title=on?"关闭声音":"开启声音";
}

/**
 * @param {object} options
 * @param {string|HTMLElement} options.el 挂载点
 * @param {"hall"|"game"} [options.mode]
 * @param {string} [options.title]
 * @param {string} [options.subtitle] 大厅副标题
 * @param {string} [options.mark] 大厅品牌符号
 * @param {string} [options.homeHref] 游戏页返回大厅
 * @param {(enabled:boolean)=>void} [options.onSoundChange]
 * @param {()=>void} [options.onSettings]
 * @param {(error:unknown)=>void} [options.onFullscreenError]
 */
export function mountHeader(options={}){
  const root=resolveEl(options.el);
  if(!root)return null;

  const mode=options.mode==="game"?"game":"hall";
  const title=options.title||(mode==="hall"?"Nocturne Games":"游戏");
  const subtitle=options.subtitle??(mode==="hall"?"把一点空闲，变成一场游戏。":"");
  const mark=options.mark||"◐";
  const homeHref=options.homeHref||"./index.html";

  root.classList.add("ng-header");
  root.dataset.mode=mode;

  const left=document.createElement("div");
  left.className="ng-header-left";

  if(mode==="hall"){
    left.classList.add("brand");
    left.innerHTML=`
      <div class="brand-mark" aria-hidden="true">${mark}</div>
      <div>
        <h1>${title}</h1>
        ${subtitle?`<p>${subtitle}</p>`:""}
      </div>
    `;
  }else{
    const back=document.createElement("a");
    back.className="ng-header-back";
    back.href=homeHref;
    back.textContent=`← ${title}`;
    left.appendChild(back);
  }

  const tools=document.createElement("div");
  tools.className="ng-header-tools";
  tools.setAttribute("role","toolbar");
  tools.setAttribute("aria-label","平台工具");

  const soundBtn=document.createElement("button");
  soundBtn.type="button";
  soundBtn.className="ng-tool-btn";
  soundBtn.id="ngSoundBtn";
  syncSoundButton(soundBtn);

  const fullscreenBtn=document.createElement("button");
  fullscreenBtn.type="button";
  fullscreenBtn.className="ng-tool-btn";
  fullscreenBtn.id="ngFullscreenBtn";
  fullscreenBtn.dataset.iconOnly="1";
  fullscreenBtn.textContent="⛶";
  fullscreenBtn.title="全屏";

  const settingsBtn=document.createElement("button");
  settingsBtn.type="button";
  settingsBtn.className="ng-tool-btn";
  settingsBtn.id="ngSettingsBtn";
  settingsBtn.textContent="⚙";
  settingsBtn.title="设置";

  tools.append(soundBtn,fullscreenBtn,settingsBtn);
  root.replaceChildren(left,tools);

  const unsub=subscribe(()=>syncSoundButton(soundBtn));

  soundBtn.addEventListener("click",()=>{
    const next=!soundOn();
    updateSettings({
      common:{
        soundEnabled:next,
        speechEnabled:next
      }
    });
    syncSoundButton(soundBtn);
    if(typeof options.onSoundChange==="function")options.onSoundChange(next);
  });

  settingsBtn.addEventListener("click",()=>{
    if(typeof options.onSettings==="function"){
      options.onSettings();
      return;
    }
    settingsBtn.title="设置中心即将上线";
    settingsBtn.classList.add("is-pulse");
    setTimeout(()=>settingsBtn.classList.remove("is-pulse"),400);
  });

  const fullscreen=setupFullscreenButton({
    button:fullscreenBtn,
    target:document.documentElement,
    onError:options.onFullscreenError
  });

  return {
    root,
    soundBtn,
    fullscreenBtn,
    settingsBtn,
    destroy(){
      unsub();
      fullscreen?.destroy?.();
    }
  };
}
