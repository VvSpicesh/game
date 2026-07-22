import {tileFace,tileName,tileDisplayName} from "./tiles.js?v=0.14.49";
import {getLegalDiscardIndexes,SUIT_LABEL,hasMissingSuit} from "./rules-guard.js";
import {getReadyHandInfo,getReadyDiscardSuggestions} from "./hu.js?v=0.15.8";
import {collectVisibleTilesForReady} from "./score.js?v=0.15.8";
import {buildSelfHandDisplayOrder,buildMeldTilePlan} from "./meld-view.js?v=0.15.6";
import {
  RELATIVE_SEAT_LABELS,
  getPlayerDisplayName,
  isValidPlayerName
} from "./player-name.js?v=0.14.46";
import {applySeatLayoutToTable,sideForPlayerIndex} from "./seat-layout.js?v=0.15.7";

const SEAT_LABELS=RELATIVE_SEAT_LABELS;
const SEAT_SIDE=["bottom","left","top","right"];
const EVENT_PRIORITY={
  discard:1,
  peng:2,
  mingGang:2,
  anGang:2,
  buGang:2,
  hu:3
};

function seatDisplayName(index,name,players){
  if(players)return getPlayerDisplayName(index,0,players);
  return isValidPlayerName(name)?name.trim():SEAT_LABELS[index];
}

const WAITING_TILE_PHASES=new Set(["摸牌","出牌","等待操作"]);
const SUIT_SORT={w:0,t:1,b:2};
const READY_SUGGESTION_LIMIT=3;

function missingSuitBadgeHtml(player){
  if(!player?.missingSuit){
    return '<span class="missing-suit-badge missing-suit-badge-pending">未定缺</span>';
  }
  const label=SUIT_LABEL[player.missingSuit];
  return `<span class="missing-suit-badge" aria-label="定缺${label}">缺${label}</span>`;
}

/**
 * 四家统一状态徽标：已胡 > 定缺 > 庄（空间不足时 已胡 优先保留）。
 */
function renderPlayerStatusBadges(player,isDealer){
  const badges=[];
  if(player?.won){
    badges.push('<span class="seat-status-badge seat-status-won">已胡</span>');
  }
  badges.push(missingSuitBadgeHtml(player));
  if(isDealer){
    badges.push('<span class="seat-status-badge dealer-badge">庄</span>');
  }
  return `<div class="seat-status-badges">${badges.join("")}</div>`;
}

function seatMetaHtml(player,showMelds){
  const parts=[`${player.hand.length}张`];
  if(showMelds&&player.melds.length)parts.push(`碰/杠×${player.melds.length}`);
  return parts.join(" · ");
}

function sortWaitingTiles(tiles){
  return [...tiles].sort((a,b)=>
    (SUIT_SORT[a.s]-SUIT_SORT[b.s])||(a.n-b.n)
  );
}

function renderReadyTileList(container,tiles,className="tile-small"){
  (tiles||[]).forEach(tile=>{
    const wrap=document.createElement("div");
    wrap.className="ready-hint-tile-wrap";
    wrap.title=tileName(tile);
    wrap.appendChild(createTileElement(tile,className));
    container.appendChild(wrap);
  });
}

function appendReadySection(container,title,className){
  const section=document.createElement("div");
  section.className=`ready-hint-section ${className||""}`.trim();
  const sectionLabel=document.createElement("div");
  sectionLabel.className="ready-hint-section-label";
  sectionLabel.textContent=title;
  section.appendChild(sectionLabel);
  const body=document.createElement("div");
  body.className="ready-hint-section-body";
  section.appendChild(body);
  container.appendChild(section);
  return body;
}

function renderReadySuggestion(container,suggestion,onSelectDiscard){
  const row=document.createElement("div");
  row.className="ready-hint-suggestion";

  const discardBlock=document.createElement("div");
  discardBlock.className="ready-hint-discard";

  const discardLabel=document.createElement("span");
  discardLabel.className="ready-hint-discard-label";
  discardLabel.textContent="打";
  discardBlock.appendChild(discardLabel);

  const discardTileWrap=document.createElement("div");
  discardTileWrap.className="ready-hint-discard-tile";
  discardTileWrap.title=tileName(suggestion.discardTile);
  discardTileWrap.appendChild(createTileElement(suggestion.discardTile,"tile-small"));
  discardBlock.appendChild(discardTileWrap);
  row.appendChild(discardBlock);

  const arrow=document.createElement("span");
  arrow.className="ready-hint-arrow";
  arrow.textContent="→";
  row.appendChild(arrow);

  const waitsBlock=document.createElement("div");
  waitsBlock.className="ready-hint-waits";
  (suggestion.waitingTileCounts||[]).forEach(({tile,remaining})=>{
    const waitItem=document.createElement("div");
    waitItem.className="ready-hint-wait-item";
    waitItem.title=`${tileName(tile)} × ${remaining}`;

    const tileWrap=document.createElement("div");
    tileWrap.className="ready-hint-wait-tile";
    tileWrap.appendChild(createTileElement(tile,"tile-small"));
    waitItem.appendChild(tileWrap);

    const count=document.createElement("span");
    count.className="ready-hint-wait-count";
    count.textContent=`×${remaining}`;
    waitItem.appendChild(count);
    waitsBlock.appendChild(waitItem);
  });
  row.appendChild(waitsBlock);

  const total=document.createElement("span");
  total.className="ready-hint-total";
  total.textContent=`共${suggestion.remainingCount}张`;
  row.appendChild(total);

  if(typeof onSelectDiscard==="function"&&Number.isInteger(suggestion.discardIndex)){
    row.classList.add("is-clickable");
    row.title=`选中${tileName(suggestion.discardTile)}（需再点一次出牌）`;
    row.addEventListener("click",()=>onSelectDiscard(suggestion.discardIndex));
  }

  container.appendChild(row);
}

/** 听牌计算用手牌：有摸牌标记时排除新摸牌；否则 3n+2 张时去掉一张 */
function handForWaitingTiles(player,drawnTileId){
  let hand=player?.hand||[];
  if(drawnTileId){
    const filtered=hand.filter(tile=>tile?.id!==drawnTileId);
    if(filtered.length<hand.length)hand=filtered;
  }else if(hand.length%3===2){
    hand=hand.slice(0,-1);
  }
  return hand;
}

/**
 * 听牌区：
 * A 未听 → 可下叫建议
 * B 已听且无换听 → 仅当前等待牌
 * C 已听且有换听 → 当前听 + 可换听（最多 3 条）
 */
function renderWaitingTiles(state,handlers={}){
  const root=document.getElementById("readyHintInline");
  const label=document.getElementById("readyHintLabel");
  const grid=document.getElementById("readyHintTiles");
  if(!root||!grid||!label)return;

  grid.innerHTML="";
  root.hidden=true;
  root.classList.remove("is-suggestions","is-ready","is-ready-change");

  const player=state.players?.[0];
  if(!player||player.won||!WAITING_TILE_PHASES.has(state.phase))return;

  const trialPlayer={
    ...player,
    hand:handForWaitingTiles(player,state.drawnTileId)
  };
  const visible=collectVisibleTilesForReady(state,0);
  const currentReady=getReadyHandInfo(trialPlayer,visible,state.activeRules);
  const waiting=sortWaitingTiles(currentReady.waitingTiles||[]);
  const isReady=waiting.length>0;
  const canSuggest=state.turn===0&&state.phase==="出牌";
  const onSelectDiscard=typeof handlers.onTileClick==="function"
    ?(index)=>handlers.onTileClick(index)
    :null;

  let suggestions=[];
  if(canSuggest){
    suggestions=isReady
      ?getReadyDiscardSuggestions(player,state,state.activeRules,{
        baselineWaitingTiles:waiting,
        baselineMaxFan:currentReady.maxWinInfo?.totalFan||0,
        changeOnly:true
      }).slice(0,READY_SUGGESTION_LIMIT)
      :getReadyDiscardSuggestions(player,state,state.activeRules)
        .slice(0,READY_SUGGESTION_LIMIT);
  }

  if(isReady&&suggestions.length){
    label.textContent="听";
    root.hidden=false;
    root.classList.add("is-ready","is-ready-change");
    const currentBody=appendReadySection(grid,"听","ready-hint-current");
    renderReadyTileList(currentBody,waiting,"tile-small");
    const changeBody=appendReadySection(grid,"可换听","ready-hint-change");
    suggestions.forEach(item=>renderReadySuggestion(changeBody,item,onSelectDiscard));
    return;
  }

  if(isReady){
    label.textContent="听";
    root.hidden=false;
    root.classList.add("is-ready");
    renderReadyTileList(grid,waiting,"tile-small");
    return;
  }

  if(suggestions.length){
    label.textContent="可下叫";
    root.hidden=false;
    root.classList.add("is-suggestions");
    suggestions.forEach(item=>renderReadySuggestion(grid,item,onSelectDiscard));
  }
}

function wait(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

export function createTileElement(tile,className=""){
  const el=document.createElement("div");
  el.className=`tile ${className}`;

  const face=document.createElement("div");
  face.className="tile-face";

  if(tile){
    face.innerHTML=tileFace(tile);
    el.title=tileName(tile);
    el.dataset.id=tile.id;
  }else{
    el.classList.add("tile-back");
  }

  el.appendChild(face);
  return el;
}

/**
 * 事件浮窗专用只读小牌：独立 DOM，绝不复用 / clone 弃牌节点。
 */
function renderEventPopupTile(tile){
  const wrap=document.createElement("div");
  wrap.className="event-popup-tile";
  wrap.setAttribute("aria-hidden","true");
  wrap.appendChild(createTileElement(tile,"tile-event-mini event-popup-tile-face"));
  return wrap;
}

/** 胡牌提示专用牌面（约桌面牌 75%，复用 createTileElement / tileFace） */
function renderHuEventTile(tile){
  const row=document.createElement("div");
  row.className="player-event-hu-tile-row";

  const label=document.createElement("div");
  label.className="player-event-hu-tile-label";
  label.textContent="胡牌";

  const wrap=document.createElement("div");
  wrap.className="player-event-hu-tile";
  wrap.setAttribute("aria-label",tileName(tile));
  wrap.appendChild(createTileElement(tile,"tile-event-hu"));
  row.appendChild(label);
  row.appendChild(wrap);
  return row;
}

export function renderGame(state,handlers){
  document.getElementById("remaining").textContent=state.wall.length;
  document.getElementById("phase").textContent=state.phase;
  const turnIndex=state.turn;
  const turnName=state.players[turnIndex]
    ?seatDisplayName(turnIndex,state.players[turnIndex].name,state.players)
    :"—";
  const dealerName=state.players[state.dealer]
    ?seatDisplayName(state.dealer,state.players[state.dealer].name,state.players)
    :"—";
  document.getElementById("turn").textContent=
    state.phase==="开局"?`庄：${dealerName}`:`轮到：${turnName}`;
  document.getElementById("statPhase").textContent=state.phase;
  document.getElementById("statTurn").textContent=
    state.phase==="开局"?`${dealerName}（庄）`:turnName;
  document.getElementById("statWall").textContent=state.wall.length;
  document.getElementById("statStatus").textContent=state.players[0].won?"已胡":"未胡";

  state.players.forEach((player,index)=>renderSeat(state,player,index,handlers));
  renderDiscards(state);
  renderMelds(state);
  applySeatLayoutToTable(document.querySelector(".table"));
  // 容量/边界依赖副露真实矩形，必须在 meld + seat-layout 之后再算
  applyAllDiscardLayouts();
  renderActions(state);
  renderWaitingTiles(state,handlers);
  renderScores(state);
}

function renderScores(state){
  const board=document.getElementById("scoreBoard");
  const feed=document.getElementById("scoreFeed");
  if(!board)return;

  const scores=Array.isArray(state.scores)?state.scores:[0,0,0,0];
  const deltas=Array.isArray(state.roundDelta)?state.roundDelta:[0,0,0,0];

  board.innerHTML="";
  state.players.forEach((player,index)=>{
    const row=document.createElement("div");
    row.className="score-row"+(scores[index]<0?" score-row-neg":"");
    const delta=deltas[index]||0;
    row.innerHTML=`
      <div class="score-name">${seatDisplayName(index,player.name,state.players)}${player.won?'<span class="score-won">已胡</span>':""}</div>
      <div class="score-total">${scores[index]}</div>
      <div class="score-delta">${delta>0?"+"+delta:String(delta)}</div>
    `;
    board.appendChild(row);
  });

  if(feed){
    feed.innerHTML="";
    feed.hidden=true;
  }
}

function renderSeat(state,player,index,handlers){
  const seat=document.getElementById(`seat-${index}`);
  seat.innerHTML="";

  const isDealer=Number.isInteger(state.dealer)&&state.dealer===index;
  const isSide=index===1||index===3;
  const avatar=index===0?"🙂":"🤖";
  const badgesHtml=renderPlayerStatusBadges(player,isDealer);
  const header=document.createElement("div");
  header.className="seat-header"+(isSide?" seat-header-side":"");

  if(index===2){
    const namePart=player.name?` ${player.name}`:"";
    header.className="seat-header seat-header-top";
    header.innerHTML=`
      <div class="seat-id">
        <span class="seat-avatar" aria-hidden="true">${avatar}</span>
        <div class="seat-text">
          <div class="seat-name-row seat-name-row-top">
            <div class="seat-name">${SEAT_LABELS[index]}${namePart}</div>
            ${badgesHtml}
          </div>
          <div class="seat-meta seat-meta-top">${seatMetaHtml(player,true)}</div>
        </div>
      </div>
    `;
  }else if(isSide){
    const nameLine=player.name
      ?`<div class="seat-name">${player.name}</div>`
      :"";
    header.innerHTML=`
      <div class="seat-id">
        <span class="seat-avatar" aria-hidden="true">${avatar}</span>
        <div class="seat-text">
          <div class="seat-label">${SEAT_LABELS[index]}</div>
          ${nameLine}
          ${badgesHtml}
          <div class="seat-meta">${seatMetaHtml(player,false)}</div>
        </div>
      </div>
    `;
  }else{
    const namePart=player.name?` ${player.name}`:"";
    header.innerHTML=`
      <div class="seat-id">
        <span class="seat-avatar" aria-hidden="true">${avatar}</span>
        <div class="seat-text">
          <div class="seat-name-row">
            <div class="seat-name">${SEAT_LABELS[index]}${namePart}</div>
            ${badgesHtml}
          </div>
          <div class="seat-meta">${seatMetaHtml(player,true)}</div>
        </div>
      </div>
    `;
  }
  seat.appendChild(header);

  const hand=document.createElement("div");
  hand.className="hand";

  if(index===1)hand.classList.add("hand-vertical","hand-left");
  if(index===3)hand.classList.add("hand-vertical","hand-right");

  const dealing=state.phase==="开局"&&state.dealing===true;
  const winTile=player.won?player.winTile:null;
  const lastIndex=player.hand.length-1;
  const legalSelf=
    index===0&&state.phase==="出牌"&&state.turn===0
      ?new Set(getLegalDiscardIndexes(player))
      :null;

  const handItems=
    index===0&&!player.won
      ?buildSelfHandDisplayOrder(player.hand,state.drawnTileId)
      :player.hand.map((tile,tileIndex)=>({tile,tileIndex,isDraw:false}));

  handItems.forEach(({tile,tileIndex,isDraw})=>{
    const isWinFace=
      Boolean(winTile) &&
      tileIndex===lastIndex &&
      tile.s===winTile.s &&
      tile.n===winTile.n;

    let el;
    if(index===0){
      el=createTileElement(tile);
      if(legalSelf&&!legalSelf.has(tileIndex))el.classList.add("tile-illegal");
    }else if(isWinFace){
      el=createTileElement(tile,"tile-small");
    }else{
      el=createTileElement(null,"tile-small");
    }

    if(isWinFace)el.classList.add("tile-win-show");
    if(dealing&&tileIndex===lastIndex)el.classList.add("tile-deal-in");

    if(index===0&&!player.won){
      if(isDraw||tile.id===state.drawnTileId)el.classList.add("tile-drawn");
      if(tileIndex===state.selectedTileIndex)el.classList.add("tile-selected");

      if(state.turn===0&&state.phase==="出牌"){
        el.addEventListener("click",()=>handlers.onTileClick(tileIndex));
      }
    }

    /* 新摸牌在最右侧：间隔插在已整理手牌与新摸牌之间 */
    if(index===0&&isDraw){
      const gap=document.createElement("div");
      gap.className="hand-draw-gap";
      gap.setAttribute("aria-hidden","true");
      hand.appendChild(gap);
    }

    hand.appendChild(el);
  });

  seat.appendChild(hand);

}

function renderMeldTile(item){
  const wrap=document.createElement("div");
  wrap.className="meld-tile-wrap tile-highlight-wrapper";
  if(item.isSource){
    wrap.classList.add("is-highlighted","is-source-tile","meld-source","is-source");
  }
  if(item.isAddedGang)wrap.classList.add("is-added-gang-tile");

  const face=document.createElement("div");
  face.className="meld-tile-face";
  face.appendChild(
    item.face==="back"
      ?createTileElement(null,"tile-small")
      :createTileElement(item.tile,"tile-small")
  );
  wrap.appendChild(face);
  return wrap;
}

/**
 * 统一副露 DOM：碰 / 明杠 / 补杠 / 暗杠
 * @param {object} meld
 * @param {number} ownerSeat
 */
export function renderMeld(meld,ownerSeat){
  const plan=buildMeldTilePlan(meld,ownerSeat);
  const group=document.createElement("div");
  const typeClass=plan.type==="anGang"?"meld-type-anGang meld-an-gang":`meld-type-${plan.type||"unknown"}`;
  group.className=`meld-group ${typeClass}`;
  if(plan.sourcePosition)group.classList.add(`meld-source-${plan.sourcePosition}`);
  group.style.setProperty("--meld-width-scale",String(plan.widthScale??1));

  const top=plan.layers?.top;
  const base=plan.layers?.base||[];

  if(top&&top.length){
    const stack=document.createElement("div");
    stack.className="meld-stack";

    const topLayer=document.createElement("div");
    topLayer.className="meld-layer meld-layer-top";
    top.forEach(item=>topLayer.appendChild(renderMeldTile(item)));

    const baseLayer=document.createElement("div");
    baseLayer.className="meld-layer meld-layer-base";
    base.forEach(item=>baseLayer.appendChild(renderMeldTile(item)));

    stack.appendChild(topLayer);
    stack.appendChild(baseLayer);
    group.appendChild(stack);
  }else{
    const flat=document.createElement("div");
    flat.className="meld-layer meld-layer-flat";
    base.forEach(item=>flat.appendChild(renderMeldTile(item)));
    group.appendChild(flat);
  }

  return group;
}

export function renderMelds(state){
  for(let index=0;index<4;index++){
    const zone=document.getElementById(`meld-${index}`);
    if(!zone)continue;
    zone.innerHTML="";

    const player=state.players[index];
    if(!player)continue;

    const seatSide=sideForPlayerIndex(index);
    const melds=seatSide==="right"
      ?[...(player.melds||[])].reverse()
      :(player.melds||[]);
    melds.forEach(meld=>{
      zone.appendChild(renderMeld(meld,index));
    });
  }
}

function resolveLatestDiscard(state){
  const tip=state.discards?.length?state.discards[state.discards.length-1]:null;
  const claim=state.lastDiscard;
  if(!tip||!claim)return null;
  if(tip.player!==claim.player||tip.tile?.id!==claim.tile?.id)return null;
  return tip;
}

function renderDiscards(state){
  const latest=resolveLatestDiscard(state);
  const cueKey=latest?`${latest.player}:${latest.tile?.id}:${state.discards.length}`:"";
  const shouldAnimate=Boolean(cueKey&&cueKey!==lastDiscardCueKey);
  if(cueKey)lastDiscardCueKey=cueKey;
  else lastDiscardCueKey="";

  for(let index=0;index<4;index++){
    const zone=document.getElementById(`discard-${index}`);
    if(!zone)continue;
    zone.innerHTML="";
    // 清掉上一帧内联尺寸，避免旧容量污染
    zone.style.removeProperty("width");
    zone.style.removeProperty("max-width");
    zone.style.removeProperty("height");
    zone.style.removeProperty("max-height");
    zone.style.removeProperty("align-self");
    zone.style.removeProperty("margin-top");
    delete zone.dataset.discardCols;
    delete zone.dataset.discardRows;
    delete zone.dataset.discardDegrade;

    const playerDiscards=state.discards.filter(item=>item.player===index);
    playerDiscards.forEach((item,localIdx)=>{
      const isLatest=latest&&item===latest;
      const wrap=document.createElement("div");
      wrap.className="discard-tile-wrap tile-highlight-wrapper";
      if(isLatest){
        wrap.classList.add(
          "discard-tile-latest",
          "is-highlighted",
          "is-latest-discard"
        );
        if(shouldAnimate)wrap.classList.add("discard-tile-latest-animate");
      }
      // 仅在 discard-zone 叠层内抬高；不得盖过 event-anchor
      wrap.style.zIndex=String(isLatest?30:(10+localIdx));
      const face=document.createElement("div");
      face.className="discard-tile-face";
      face.appendChild(createTileElement(item.tile,"tile-discard discard-tile"));
      wrap.appendChild(face);
      zone.appendChild(wrap);
    });
  }

  updateDiscardCue(latest,shouldAnimate,state.players);
}

/** 弃牌布局安全间距（相对副露外接矩形） */
const DISCARD_SAFETY_GAP=14;
/** 最新牌高亮 / 描边额外外边距 */
const DISCARD_HIGHLIGHT_PAD=4;
const DISCARD_OVERLAP_FRAC=0.18;
const DISCARD_CENTER_COLS_PREFERRED=9;
const DISCARD_CENTER_COLS_FALLBACK=8;
const DISCARD_SIDE_COLS_PREFERRED=9;
const DISCARD_SIDE_COLS_FALLBACK=8;
const DISCARD_SIDE_MIN_PER_COL=4;

function readPx(value){
  const num=Number.parseFloat(value||"0");
  return Number.isFinite(num)?num:0;
}

function readDiscardGapPx(table){
  const gap=parseFloat(getComputedStyle(table).getPropertyValue("--discard-tile-gap"));
  return Number.isFinite(gap)?gap:3;
}

function lineWidthPx(cols,tileOuterW,gap){
  return cols*tileOuterW+(cols-1)*gap+DISCARD_HIGHLIGHT_PAD;
}

function lineHeightPx(rows,tileOuterH,gap){
  return rows*tileOuterH+(rows-1)*gap+DISCARD_HIGHLIGHT_PAD;
}

/**
 * 上下弃牌可用宽度：左家副露右缘 → 右家副露左缘
 */
function getAvailableCenterWidth(tableRect){
  const leftMeld=document.getElementById("meld-1")?.getBoundingClientRect();
  const rightMeld=document.getElementById("meld-3")?.getBoundingClientRect();
  const hasLeft=leftMeld&&leftMeld.width>1;
  const hasRight=rightMeld&&rightMeld.width>1;
  const left=hasLeft
    ?leftMeld.right+DISCARD_SAFETY_GAP
    :(tableRect.left+(tableRect.width*0.18));
  const right=hasRight
    ?rightMeld.left-DISCARD_SAFETY_GAP
    :(tableRect.right-(tableRect.width*0.18));
  return Math.max(0,right-left);
}

/**
 * 左右弃牌可用高度：固定安全带（不随副露 DOM 行数变化）
 */
function getAvailableSideHeight(tableRect,table){
  const cs=table?getComputedStyle(table):null;
  const bandTop=cs?readPx(cs.getPropertyValue("--band-top")):tableRect.height*0.2;
  const bandBottom=cs?readPx(cs.getPropertyValue("--band-bottom")):tableRect.height*0.3;
  const sideMeldBand=cs?readPx(cs.getPropertyValue("--side-meld-band")):72;
  const seatGap=cs?readPx(cs.getPropertyValue("--seat-zone-gap")):14;
  const top=tableRect.top+bandTop+sideMeldBand+seatGap;
  const bottom=tableRect.bottom-bandBottom;
  return Math.max(0,bottom-top);
}

/** 左右弃牌区顶端：相对 seat-local 的固定偏移 */
function getSideDiscardMarginTop(localRect,table,tableRect){
  const cs=table?getComputedStyle(table):null;
  const sideMeldBand=cs?readPx(cs.getPropertyValue("--side-meld-band")):72;
  const seatGap=cs?readPx(cs.getPropertyValue("--seat-zone-gap")):14;
  const bandTop=cs?readPx(cs.getPropertyValue("--band-top")):0;
  const localTopFromTable=localRect.top-tableRect.top;
  const targetFromLocalTop=Math.max(0,bandTop+sideMeldBand+seatGap-localTopFromTable);
  return Math.round(targetFromLocalTop);
}

/**
 * PC/宽平板优先 9；较窄横屏降 8；极窄才允许更小。
 * @returns {{cols:number, degrade:string|null}}
 */
function resolveCenterCols(availableWidth,tileOuterW,gap){
  const need9=lineWidthPx(DISCARD_CENTER_COLS_PREFERRED,tileOuterW,gap);
  const need8=lineWidthPx(DISCARD_CENTER_COLS_FALLBACK,tileOuterW,gap);
  const vw=window.innerWidth||document.documentElement.clientWidth||1024;
  const vh=window.innerHeight||document.documentElement.clientHeight||800;
  const narrowLandscape=(vw>vh&&vw<900)||(vh<=560&&vw<1100);

  if(availableWidth>=need9&&!narrowLandscape){
    return{cols:DISCARD_CENTER_COLS_PREFERRED,degrade:null};
  }
  if(availableWidth>=need9&&narrowLandscape){
    // 窄横屏：仍优先 9（空间够就用）；否则降 8
    return{cols:DISCARD_CENTER_COLS_PREFERRED,degrade:null};
  }
  if(availableWidth>=need8){
    return{
      cols:DISCARD_CENTER_COLS_FALLBACK,
      degrade:`availableWidth ${Math.round(availableWidth)}px < need9 ${Math.round(need9)}px`
    };
  }
  // 极窄手机横屏：按可放张数，底线 6
  const fit=Math.max(
    6,
    Math.floor((availableWidth-DISCARD_HIGHLIGHT_PAD+gap)/(tileOuterW+gap))
  );
  return{
    cols:Math.min(DISCARD_CENTER_COLS_FALLBACK,fit),
    degrade:`extreme narrow phone landscape: fit=${fit}, avail=${Math.round(availableWidth)}px, vw=${vw}`
  };
}

function resolveSideRows(availableHeight,tileOuterH,gap){
  const need9=lineHeightPx(DISCARD_SIDE_COLS_PREFERRED,tileOuterH,gap);
  const need8=lineHeightPx(DISCARD_SIDE_COLS_FALLBACK,tileOuterH,gap);
  if(availableHeight>=need9)return DISCARD_SIDE_COLS_PREFERRED;
  if(availableHeight>=need8){
    return DISCARD_SIDE_COLS_FALLBACK;
  }
  const raw=Math.floor((availableHeight+gap)/(tileOuterH+gap));
  return Math.max(
    DISCARD_SIDE_MIN_PER_COL,
    Math.min(DISCARD_SIDE_COLS_FALLBACK,raw||DISCARD_SIDE_MIN_PER_COL)
  );
}

function applyAllDiscardLayouts(){
  for(let index=0;index<4;index++){
    const zone=document.getElementById(`discard-${index}`);
    if(zone)applyDiscardLayout(index,zone);
  }
}

/**
 * 统一入口：按座位方向使用不同容量参数。
 * horizontal: 每排 9（可降 8），第 2 排起行重叠
 * vertical: 每列优先 9（可降 8），第 2 列起列重叠
 */
function applyDiscardLayout(seatIndex,zone){
  const tiles=[...zone.querySelectorAll(".discard-tile-wrap")];
  tiles.forEach(t=>{t.style.translate="";});

  const table=document.querySelector(".table");
  if(!table)return;
  const tableRect=table.getBoundingClientRect();
  const gap=readDiscardGapPx(table);
  const isHorizontal=seatIndex===0||seatIndex===2;

  // 无牌时仍清尺寸，避免旧压力场景残留
  if(!tiles.length){
    zone.style.removeProperty("width");
    zone.style.removeProperty("max-width");
    zone.style.removeProperty("height");
    zone.style.removeProperty("max-height");
    return;
  }

  const base=tiles[0].getBoundingClientRect();

  if(isHorizontal){
    const tileW=base.width;
    const tileH=base.height;
    const availW=getAvailableCenterWidth(tableRect);
    const{cols,degrade}=resolveCenterCols(availW,tileW,gap);
    const widthPx=lineWidthPx(cols,tileW,gap);

    zone.dataset.discardCols=String(cols);
    if(degrade)zone.dataset.discardDegrade=degrade;
    else delete zone.dataset.discardDegrade;

    // 固定列宽强制换行；不用 availW 再压窄（否则会少于 cols）
    zone.style.width=`${Math.round(widthPx)}px`;
    zone.style.maxWidth=`${Math.round(widthPx)}px`;
    zone.style.removeProperty("height");
    zone.style.removeProperty("max-height");
    zone.style.removeProperty("margin-top");

    // 第一排完整；第 2 排起向第一排方向叠压 18%
    const fullLinesBeforeOverlap=1;
    const stepPx=gap+tileH*DISCARD_OVERLAP_FRAC;
    const sign=seatIndex===0?1:-1; // self wrap-reverse：新行在上，向下压

    tiles.forEach((t,idx)=>{
      const line=Math.floor(idx/cols);
      if(line<fullLinesBeforeOverlap)return;
      const steps=line-(fullLinesBeforeOverlap-1);
      t.style.translate=`0px ${sign*stepPx*steps}px`;
    });
    return;
  }

  // —— 左右：垂直走廊容量（固定安全带） ——
  const tileW=base.width;
  const tileH=base.height;
  const availH=getAvailableSideHeight(tableRect,table);
  const perCol=resolveSideRows(availH,tileH,gap);
  const heightPx=Math.min(lineHeightPx(perCol,tileH,gap),availH||lineHeightPx(perCol,tileH,gap));

  zone.dataset.discardRows=String(perCol);
  if(perCol<DISCARD_SIDE_COLS_PREFERRED){
    zone.dataset.discardDegrade=`side rows ${perCol} (availH ${Math.round(availH)}px < need9)`;
  }else{
    delete zone.dataset.discardDegrade;
  }
  zone.style.height=`${Math.round(heightPx)}px`;
  zone.style.maxHeight=`${Math.round(Math.min(heightPx,availH||heightPx))}px`;
  zone.style.alignSelf="flex-start";
  zone.style.removeProperty("width");

  const localEl=zone.closest(".seat-local");
  const localRect=localEl?.getBoundingClientRect();
  if(localRect){
    zone.style.marginTop=`${getSideDiscardMarginTop(localRect,table,tableRect)}px`;
  }else{
    zone.style.removeProperty("margin-top");
  }

  // 第一列完整；第 2 列起向第一列方向叠压 18%（与上下家行重叠同比例）
  // 左家：新列在右 → translateX 负向叠回；右家（wrap-reverse）：新列在左 → translateX 正向叠回
  const fullLinesBeforeOverlap=1;
  const stepPx=gap+tileW*DISCARD_OVERLAP_FRAC;
  const sign=seatIndex===1?-1:1;

  tiles.forEach((t,idx)=>{
    const line=Math.floor(idx/perCol);
    if(line<fullLinesBeforeOverlap)return;
    const steps=line-(fullLinesBeforeOverlap-1);
    t.style.translate=`${sign*stepPx*steps}px 0px`;
    // 越新的列越高；最新弃牌仍由 discard-tile-latest 的 z-index 盖过
    if(!t.classList.contains("discard-tile-latest")){
      t.style.zIndex=String(10+idx);
    }
  });
}

let lastDiscardCueKey="";
/** @type {Map<number, {el: HTMLElement, timer: number, raf: number, priority: number, eventId: number|null, action: string}>} */
const activePlayerEvents=new Map();
/** @type {{eventId: number, playerIndex: number}|null} */
let activeDiscardEvent=null;

function clearPlayerEventSlot(slot){
  if(!slot)return;
  if(slot.timer){
    clearTimeout(slot.timer);
    slot.timer=0;
  }
  if(slot.raf){
    cancelAnimationFrame(slot.raf);
    slot.raf=0;
  }
}

function syncSeatLocalEventLayers(){
  for(let index=0;index<4;index++){
    const local=document.getElementById(`seat-local-${index}`);
    if(!local)continue;
    local.classList.toggle("seat-local-event-active",activePlayerEvents.has(index));
  }
}

function clearPlayerEventOn(playerIndex){
  const slot=activePlayerEvents.get(playerIndex);
  if(!slot)return;
  clearPlayerEventSlot(slot);
  slot.el?.remove();
  activePlayerEvents.delete(playerIndex);
  if(activeDiscardEvent?.playerIndex===playerIndex)activeDiscardEvent=null;
  syncSeatLocalEventLayers();
}

/** 立即移除所有座位事件提示（无动画） */
export function clearPlayerEvent(){
  for(const playerIndex of [...activePlayerEvents.keys()]){
    clearPlayerEventOn(playerIndex);
  }
  activeDiscardEvent=null;
  syncSeatLocalEventLayers();
}

function dismissPlayerEvent(playerIndex){
  const slot=activePlayerEvents.get(playerIndex);
  if(!slot)return;
  const el=slot.el;
  clearPlayerEventSlot(slot);
  el.classList.remove("is-show");
  el.classList.add("is-hide");
  const done=()=>{
    const current=activePlayerEvents.get(playerIndex);
    if(current?.el===el){
      el.remove();
      activePlayerEvents.delete(playerIndex);
      if(activeDiscardEvent?.playerIndex===playerIndex)activeDiscardEvent=null;
      syncSeatLocalEventLayers();
    }
  };
  el.addEventListener("transitionend",done,{once:true});
  setTimeout(done,220);
}

function buildPlayerEventCopy({
  action,
  playerIndex,
  tile=null,
  players=[],
  viewerIndex=0
}){
  const actor=getPlayerDisplayName(playerIndex,viewerIndex,players);
  const tileLabel=tile?tileDisplayName(tile):"";
  switch(action){
    case "discard":
      return{name:actor,actionWord:"打出",tileLabel,detail:null,tone:"discard"};
    default:
      return{name:actor,actionWord:String(action||""),tileLabel,detail:null,tone:"claim"};
  }
}

const DISCARD_EVENT_SIDE_CLASS={
  0:"discard-event-bottom",
  1:"discard-event-left",
  2:"discard-event-top",
  3:"discard-event-right"
};

/** 碰/杠/胡默认标题与时长（出牌仍走 showDiscardEvent） */
const PLAYER_EVENT_DEFAULTS={
  peng:{title:"碰",duration:1200,tone:"claim"},
  mingGang:{title:"杠",duration:1500,tone:"claim"},
  anGang:{title:"暗杠",duration:1500,tone:"claim"},
  buGang:{title:"补杠",duration:1500,tone:"claim"},
  hu:{title:"胡",duration:3000,tone:"hu"},
  discard:{title:"打出",duration:1400,tone:"discard"}
};

/**
 * 出牌浮窗：按座位靠近出牌方，不共用中央锚点语义。
 */
export function showDiscardEvent(options={}){
  const playerIndex=Number(options.playerIndex);
  if(!Number.isInteger(playerIndex)||playerIndex<0||playerIndex>3)return;
  showPlayerEvent({
    ...options,
    playerIndex,
    type:"discard",
    showSelfDiscard:options.showSelfDiscard!==false,
    duration:Math.max(400,Number(options.duration)||1400),
    discardSideClass:DISCARD_EVENT_SIDE_CLASS[playerIndex]||"discard-event-bottom"
  });
}

/**
 * 统一座位事件提示（碰 / 杠 / 胡 / 出牌）。
 * 胡牌不再使用中央 WinNotice。
 *
 * @param {object} options
 * @param {number} options.playerIndex
 * @param {"discard"|"peng"|"mingGang"|"anGang"|"buGang"|"hu"} [options.type]
 * @param {"discard"|"peng"|"mingGang"|"anGang"|"buGang"|"hu"} [options.action] 兼容旧字段
 * @param {string} [options.title] 主标题（碰 / 杠 / 胡 / 自摸…）
 * @param {string} [options.pattern] 胡牌牌型
 * @param {number|null} [options.fan]
 * @param {string} [options.score]
 * @param {string} [options.scoreText] 兼容旧字段
 * @param {boolean} [options.blocking] 自己胡：不自动消失 + 确认
 * @param {boolean} [options.requireConfirm] 兼容旧字段
 * @param {(()=>void)|null} [options.onConfirm]
 * @param {number} [options.duration]
 * @param {object|null} [options.tile]
 * @param {number|null} [options.sourceEventId]
 * @param {number|null} [options.eventId]
 * @param {Array} [options.players]
 * @param {boolean} [options.showSelfDiscard=false]
 * @param {string} [options.discardSideClass]
 */
export function showPlayerEvent(options={}){
  const playerIndex=Number(options.playerIndex);
  const type=options.type||options.action||"discard";
  if(!Number.isInteger(playerIndex)||playerIndex<0||playerIndex>3)return;

  if(type==="discard"&&playerIndex===0&&!options.showSelfDiscard)return;

  const defaults=PLAYER_EVENT_DEFAULTS[type]||PLAYER_EVENT_DEFAULTS.peng;
  const priority=EVENT_PRIORITY[type]||1;
  const existing=activePlayerEvents.get(playerIndex);
  if(existing&&priority<existing.priority)return;

  const table=document.querySelector(".table");
  if(!table)return;

  const players=options.players||[];
  const viewerIndex=Number.isInteger(options.viewerIndex)?options.viewerIndex:0;
  const sourceEventId=options.sourceEventId??null;
  const eventId=options.eventId??null;
  const title=String(options.title??defaults.title??"").trim()||defaults.title;
  const pattern=String(options.pattern??options.patternName??"").trim();
  const fan=options.fan;
  const score=String(options.score??options.scoreText??"").trim();
  const blocking=Boolean(options.blocking??options.requireConfirm)&&type==="hu";
  const onConfirm=typeof options.onConfirm==="function"?options.onConfirm:null;
  const duration=Math.max(400,Number(options.duration)||defaults.duration);
  const tone=defaults.tone||"claim";

  const anchor=document.getElementById(`event-anchor-${playerIndex}`);
  if(!anchor)return;

  const discardSideClass=
    type==="discard"
      ?(options.discardSideClass||DISCARD_EVENT_SIDE_CLASS[playerIndex]||"")
      :"";

  function renderClaimStack(el){
    el.innerHTML="";
    el.className=[
      "player-event-toast",
      `player-event-${tone}`,
      blocking?"is-confirming":""
    ].filter(Boolean).join(" ");
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    el.dataset.action=String(type);
    el.dataset.eventId=eventId!=null?String(eventId):"";
    el.dataset.sourceEventId=sourceEventId!=null?String(sourceEventId):"";

    const content=document.createElement("div");
    content.className=type==="hu"
      ?"player-event-content player-event-content-hu"
      :"player-event-content";

    const main=document.createElement("div");
    main.className="player-event-main player-event-stack";

    const titleEl=document.createElement("div");
    titleEl.className="player-event-action";
    titleEl.textContent=title;
    main.appendChild(titleEl);

    if(pattern){
      const patternEl=document.createElement("div");
      patternEl.className="player-event-pattern";
      patternEl.textContent=pattern;
      main.appendChild(patternEl);
    }

    if(fan!=null&&Number.isFinite(Number(fan))){
      const fanEl=document.createElement("div");
      fanEl.className="player-event-fan";
      fanEl.textContent=`${Number(fan)}番`;
      main.appendChild(fanEl);
    }

    if(score){
      const scoreEl=document.createElement("div");
      scoreEl.className="player-event-score";
      scoreEl.textContent=score;
      main.appendChild(scoreEl);
    }

    content.appendChild(main);

    if(type==="hu"&&options.tile){
      content.appendChild(renderHuEventTile(options.tile));
    }

    el.appendChild(content);

    if(blocking){
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="btn btn-primary player-event-confirm";
      btn.textContent="确认";
      btn.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();
        dismissPlayerEvent(playerIndex);
        onConfirm?.();
      });
      el.appendChild(btn);
    }
  }

  function renderDiscard(el){
    const copy=buildPlayerEventCopy({
      action:"discard",
      playerIndex,
      tile:options.tile||null,
      players,
      viewerIndex
    });
    el.innerHTML="";
    el.className=[
      "player-event-toast",
      "player-event-discard",
      discardSideClass
    ].filter(Boolean).join(" ");
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    el.dataset.action="discard";
    el.dataset.eventId=eventId!=null?String(eventId):"";
    el.dataset.sourceEventId="";

    const main=document.createElement("div");
    main.className="player-event-main player-event-main-inline";

    const nameEl=document.createElement("span");
    nameEl.className="player-event-name";
    nameEl.textContent=copy.name;
    main.appendChild(nameEl);

    const actionEl=document.createElement("span");
    actionEl.className="player-event-action";
    actionEl.textContent=copy.actionWord;
    main.appendChild(actionEl);

    if(options.tile){
      main.appendChild(renderEventPopupTile(options.tile));
    }

    el.appendChild(main);
  }

  function renderInto(el){
    if(type==="discard")renderDiscard(el);
    else renderClaimStack(el);
  }

  const shouldUpgrade=
    activeDiscardEvent!=null&&
    sourceEventId!=null&&
    activeDiscardEvent.eventId===sourceEventId;

  let el=null;
  if(shouldUpgrade){
    clearPlayerEventOn(activeDiscardEvent.playerIndex);
    activeDiscardEvent=null;
    clearPlayerEventOn(playerIndex);
    el=document.createElement("div");
    renderInto(el);
    anchor.appendChild(el);
  }else{
    clearPlayerEventOn(playerIndex);
    el=document.createElement("div");
    renderInto(el);
    anchor.appendChild(el);
  }

  syncSeatLocalEventLayers();

  const slot={
    el,
    timer:0,
    raf:0,
    priority,
    eventId,
    action:type
  };
  activePlayerEvents.set(playerIndex,slot);

  if(type==="discard"&&eventId!=null){
    activeDiscardEvent={eventId,playerIndex};
  }else if(shouldUpgrade){
    activeDiscardEvent=null;
  }

  slot.raf=requestAnimationFrame(()=>{
    slot.raf=0;
    el.classList.add("is-show");
    el.classList.remove("is-hide");
  });

  // blocking（自己胡）一直显示，等确认
  if(!blocking){
    slot.timer=setTimeout(()=>{
      slot.timer=0;
      dismissPlayerEvent(playerIndex);
    },duration);
  }
}

function updateDiscardCue(latest,animate,players){
  if(!latest?.tile||!animate)return;
  showDiscardEvent({
    playerIndex:latest.player,
    tile:latest.tile,
    eventId:latest.eventId,
    players:players||[],
    duration:1400,
    showSelfDiscard:true
  });
}

/**
 * 兼容旧调用：碰/杠/胡座位飘字 → 统一走 showPlayerEvent
 */
export function showPlayerActionEffect(playerIndex,actionName,tile,scoreText=""){
  const map={
    碰:"peng",
    杠:"mingGang",
    明杠:"mingGang",
    直杠:"mingGang",
    暗杠:"anGang",
    补杠:"buGang",
    胡:"hu"
  };
  const type=map[actionName]||actionName||"peng";
  showPlayerEvent({
    playerIndex,
    type,
    score:scoreText||"",
    players:[],
    duration:PLAYER_EVENT_DEFAULTS[type]?.duration
  });
}

function renderActions(state){
  const actions=document.getElementById("actions");

  if(state.phase==="出牌"&&state.turn===0){
    actions.textContent=state.selectedTileIndex===null
      ?"请先点一张牌，选中后会抬高。"
      :"再点一次同一张牌即可打出。";
  }else if(state.phase==="换三张"){
    actions.textContent="请选择任意三张牌进行交换。";
  }else if(state.phase==="定缺"){
    actions.textContent="请选择本局要打缺的一门。";
  }else if(state.phase==="等待操作"){
    actions.textContent="请选择碰、杠、胡或过。";
  }else if(state.phase==="开局"){
    actions.textContent=state.dealing?"正在从庄家起按顺序发牌…":"正在掷骰定庄…";
  }else if(state.phase==="准备"){
    actions.textContent="点击桌面中央「开始」进入新牌局。";
  }else if(state.phase==="结束"){
    actions.textContent="本局已结束。";
  }else{
    actions.textContent="电脑正在自动摸牌和出牌。";
  }
}

export function renderLog(messages){
  const el=document.getElementById("log");
  el.innerHTML="";

  /* 出牌流水不刷屏；只留碰/杠/胡/阶段等最近几条 */
  const discardLine=/打出\s|摸牌/;
  const filtered=(messages||[]).filter(message=>!discardLine.test(message));
  filtered.slice(-7).reverse().forEach(message=>{
    const p=document.createElement("p");
    p.textContent=message;
    el.appendChild(p);
  });
}

export function renderExchange(hand,selectedIndexes,onToggle){
  const box=document.getElementById("exchangeHand");
  const count=document.getElementById("exchangeCount");
  const confirm=document.getElementById("exchangeConfirm");

  box.innerHTML="";

  hand.forEach((tile,index)=>{
    const el=createTileElement(tile);
    el.dataset.exchangeIndex=String(index);

    const order=selectedIndexes.indexOf(index);
    if(order>=0){
      el.classList.add("exchange-selected");
      el.dataset.order=String(order+1);
    }

    box.appendChild(el);
  });

  count.textContent=`已选 ${selectedIndexes.length}/3`;
  confirm.disabled=selectedIndexes.length!==3;

  box.onclick=(event)=>{
    const tile=event.target.closest(".tile[data-exchange-index]");
    if(!tile||!box.contains(tile))return;
    const index=Number(tile.dataset.exchangeIndex);
    if(Number.isInteger(index))onToggle(index);
  };
}

export function showReaction(title,text,actions){
  const dock=document.getElementById("actionDock");
  const textBox=document.getElementById("actionDockText");
  const buttonBox=document.getElementById("actionDockButtons");

  textBox.textContent=text?`${title}：${text}`:title;
  buttonBox.innerHTML="";

  actions.forEach(action=>{
    const button=document.createElement("button");
    button.type="button";
    button.className=
      "action-dock-button" +
      (action.primary?" primary":"") +
      (action.label==="过"?" pass":"");

    if(action.tile&&action.label!=="过"){
      const tileWrap=document.createElement("div");
      tileWrap.className="reaction-tile";
      tileWrap.appendChild(createTileElement(action.tile,"tile-reaction"));
      button.appendChild(tileWrap);
    }

    const label=document.createElement("div");
    label.className="reaction-label";
    label.textContent=action.label;
    button.appendChild(label);

    button.onclick=()=>{
      dock.classList.remove("show");
      buttonBox.innerHTML="";
      action.run();
    };
    buttonBox.appendChild(button);
  });

  dock.classList.add("show");
}

export function hideReaction(){
  const dock=document.getElementById("actionDock");
  const buttonBox=document.getElementById("actionDockButtons");
  dock.classList.remove("show");
  buttonBox.innerHTML="";
}

export function showRoundEnd(reason,summary,onNewGame,settlement=null){
  document.getElementById("roundEndTitle").textContent=reason;
  const pigLines=(settlement?.flowerPigResults||[])
    .filter(r=>r.isFlowerPig)
    .map(r=>{
      const suit=r.missingSuitLabel||r.missingSuit||"";
      return r.paid
        ?`${r.name}花猪（缺${suit}）${r.note?` · ${r.note}`:""}`
        :`${r.name}花猪（缺${suit}）· 罚分待配置`;
    });
  const detail=[
    "本局战况如下，可再看一眼桌面，或直接开下一局。",
    pigLines.length?`花猪：${pigLines.join("；")}`:""
  ].filter(Boolean).join("\n");
  document.getElementById("roundEndDetail").textContent=detail;

  const list=document.getElementById("roundEndSummary");
  if(list){
    list.innerHTML="";
    (summary||[]).forEach(row=>{
      const el=document.createElement("div");
      el.className="round-sum-row"+(row.total<0?" score-row-neg":"");
      const delta=row.delta||0;
      const miss=row.missingSuitLabel?` · 缺${row.missingSuitLabel}`:"";
      el.innerHTML=`
        <div class="round-sum-name">${row.name}${miss}</div>
        <div class="round-sum-status">${row.status||(row.won?"已胡":"未胡")}</div>
        <div class="round-sum-delta">${delta>0?"+"+delta:String(delta)}</div>
        <div class="round-sum-total">总分 ${row.total}</div>
      `;
      list.appendChild(el);
    });
  }

  document.getElementById("roundEndModal").classList.add("show");

  const stay=document.getElementById("roundEndStay");
  const neu=document.getElementById("roundEndNew");
  stay.onclick=()=>{
    document.getElementById("roundEndModal").classList.remove("show");
  };
  neu.onclick=()=>{
    document.getElementById("roundEndModal").classList.remove("show");
    onNewGame();
  };
}

export function hideRoundReveal(){
  const modal=document.getElementById("roundRevealModal");
  if(modal)modal.classList.remove("show");
}

/**
 * 终局合并面板：得分说明 + 每家一行牌面（副露/手牌/听牌）
 */
export function renderRoundReveal(state,settlement,handlers={}){
  const modal=document.getElementById("roundRevealModal");
  const list=document.getElementById("roundRevealList");
  if(!modal||!list)return;

  const reason=handlers.reason||"";
  const summary=handlers.summary||null;
  const titleEl=document.getElementById("roundRevealReason");
  const detailEl=document.getElementById("roundRevealDetail");
  if(titleEl)titleEl.textContent=reason||"本局结束";
  if(detailEl){
    detailEl.textContent="";
    detailEl.hidden=true;
  }

  const pigs=new Set(
    (settlement?.flowerPigResults||[])
      .filter(r=>r.isFlowerPig)
      .map(r=>r.playerIndex)
  );
  const readyMap=new Map(
    (settlement?.readyHandResults||[]).map(r=>[r.playerIndex,r])
  );
  const summaryMap=new Map(
    (summary||[]).map((row,i)=>[i,row])
  );

  list.innerHTML="";
  (state.players||[]).forEach((player,index)=>{
    const card=document.createElement("section");
    card.className="reveal-seat";

    const sum=summaryMap.get(index);
    const ready=readyMap.get(index);
    const tags=[];
    if(player.won||sum?.won)tags.push(["已胡","reveal-tag-won"]);
    if(pigs.has(index)||sum?.flowerPig)tags.push(["花猪","reveal-tag-pig"]);
    if(!(player.won||sum?.won)&&!(pigs.has(index)||sum?.flowerPig)){
      if(ready?.isReady||sum?.isReady)tags.push(["已下叫","reveal-tag-ready"]);
      else if(ready||sum?.isReady===false)tags.push(["未下叫","reveal-tag-noready"]);
    }
    const missLabel=sum?.missingSuitLabel||(player.missingSuit?SUIT_LABEL[player.missingSuit]:"");
    if(missLabel)tags.push([`缺${missLabel}`,"reveal-tag-miss"]);

    const bits=sum?.bits||[];
    const delta=sum?.delta??0;
    const total=sum?.total??0;

    const row=document.createElement("div");
    row.className="reveal-seat-row";
    card.appendChild(row);

    const main=document.createElement("div");
    main.className="reveal-seat-main";
    row.appendChild(main);

    const scoreBox=document.createElement("div");
    scoreBox.className="reveal-seat-score";
    scoreBox.innerHTML=`
      <span class="reveal-delta">${delta>0?"+"+delta:String(delta)}</span>
      <span class="reveal-total">总分 ${total}</span>
    `;
    row.appendChild(scoreBox);

    const head=document.createElement("div");
    head.className="reveal-seat-head";
    head.innerHTML=`
      <div class="reveal-seat-top">
        <div class="reveal-seat-name">${seatDisplayName(index,player.name,state.players)}</div>
        <div class="reveal-seat-tags">${
          tags.map(([text,cls])=>`<span class="reveal-tag ${cls}">${text}</span>`).join("")
        }</div>
        <div class="reveal-seat-bits">${
          bits.length
            ?bits.map(b=>`<span class="reveal-bit">${b}</span>`).join("")
            :`<span class="reveal-bit reveal-bit-muted">${sum?.status||"本局无独立流水"}</span>`
        }</div>
      </div>
    `;
    main.appendChild(head);

    const tilesRow=document.createElement("div");
    tilesRow.className="reveal-tiles-row result-tiles-wrap";

    (player.melds||[]).forEach(meld=>{
      const group=document.createElement("div");
      group.className="reveal-meld-group meld-group";
      (meld.tiles||[]).forEach(tile=>{
        group.appendChild(createTileElement(tile,"tile-reveal"));
      });
      tilesRow.appendChild(group);
    });

    const handGroup=document.createElement("div");
    handGroup.className="reveal-hand-inline hand-group";
    const winTile=player.won?player.winTile:null;
    const hand=player.hand||[];
    let winHandIndex=-1;
    if(winTile){
      for(let i=hand.length-1;i>=0;i--){
        const t=hand[i];
        if(winTile.id&&t.id===winTile.id){winHandIndex=i;break;}
        if(t.s===winTile.s&&t.n===winTile.n){winHandIndex=i;break;}
      }
    }
    hand.forEach((tile,tileIndex)=>{
      const el=createTileElement(tile,"tile-reveal");
      if(tileIndex===winHandIndex)el.classList.add("tile-reveal-win");
      handGroup.appendChild(el);
    });
    if(hand.length)tilesRow.appendChild(handGroup);

    if(player.won&&winTile){
      const winGroup=document.createElement("div");
      winGroup.className="reveal-win-inline";
      const lab=document.createElement("span");
      lab.className="reveal-win-inline-label";
      lab.textContent="胡";
      winGroup.appendChild(lab);
      const winEl=createTileElement(
        {s:winTile.s,n:winTile.n,id:winTile.id||`reveal-hu-${index}`},
        "tile-reveal tile-reveal-win"
      );
      winGroup.appendChild(winEl);
      tilesRow.appendChild(winGroup);
    }

    const waits=ready?.waitingTiles||sum?.waitingTiles||[];
    if((ready?.isReady||sum?.isReady)&&waits.length){
      const waitGroup=document.createElement("div");
      waitGroup.className="reveal-wait-inline";
      const lab=document.createElement("span");
      lab.className="reveal-wait-inline-label";
      lab.textContent="听";
      waitGroup.appendChild(lab);
      waits.forEach((tile,ti)=>{
        waitGroup.appendChild(
          createTileElement(
            {s:tile.s,n:tile.n,id:`reveal-wait-${index}-${ti}`},
            "tile-reveal"
          )
        );
      });
      tilesRow.appendChild(waitGroup);
    }

    main.appendChild(tilesRow);
    list.appendChild(card);
  });

  modal.classList.add("show");
  document.getElementById("roundEndModal")?.classList.remove("show");

  const btnNew=document.getElementById("roundRevealNew");
  const btnSettle=document.getElementById("roundRevealSettle");
  const btnClose=document.getElementById("roundRevealClose");
  if(btnNew){
    btnNew.onclick=()=>{
      hideRoundReveal();
      handlers.onNewGame?.();
    };
  }
  if(btnSettle){
    btnSettle.hidden=true;
    btnSettle.onclick=null;
  }
  if(btnClose){
    btnClose.onclick=()=>{
      hideRoundReveal();
      handlers.onClose?.();
    };
  }
}


export function showMissingSuitModal(hand,onPick){
  const modal=document.getElementById("missingSuitModal");
  if(!modal)return;

  const handBox=document.getElementById("missingSuitHand");
  if(handBox){
    handBox.innerHTML="";
    (hand||[]).forEach(tile=>{
      const el=createTileElement(tile);
      el.classList.add("tile-readonly");
      el.style.cursor="default";
      handBox.appendChild(el);
    });
  }

  const counts={w:0,t:0,b:0};
  (hand||[]).forEach(tile=>{if(counts[tile.s]!=null)counts[tile.s]++;});

  const actions=document.getElementById("missingSuitActions");
  if(actions){
    actions.innerHTML="";
    const options=[
      {suit:"w",label:"缺万",sample:{s:"w",n:5,id:"ms-w"}},
      {suit:"t",label:"缺条",sample:{s:"t",n:5,id:"ms-t"}},
      {suit:"b",label:"缺筒",sample:{s:"b",n:5,id:"ms-b"}}
    ];
    options.forEach(({suit,label,sample})=>{
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="missing-suit-pick";
      btn.dataset.suit=suit;
      btn.setAttribute("aria-label",`${label}（手中${counts[suit]}张）`);

      const face=createTileElement(sample,"tile-missing-suit");
      face.style.cursor="inherit";
      btn.appendChild(face);

      const caption=document.createElement("span");
      caption.className="missing-suit-pick-label";
      caption.textContent=label;
      btn.appendChild(caption);

      const meta=document.createElement("span");
      meta.className="missing-suit-pick-meta";
      meta.textContent=`手中 ${counts[suit]} 张`;
      btn.appendChild(meta);

      btn.onclick=()=>onPick(suit);
      actions.appendChild(btn);
    });
  }

  modal.classList.add("show");
}

export function hideMissingSuitModal(){
  document.getElementById("missingSuitModal")?.classList.remove("show");
  const handBox=document.getElementById("missingSuitHand");
  if(handBox)handBox.innerHTML="";
  const actions=document.getElementById("missingSuitActions");
  if(actions)actions.innerHTML="";
}

export function hideStartOverlay(){
  const overlay=document.getElementById("startOverlay");
  if(!overlay)return;
  overlay.hidden=true;
  overlay.classList.remove("lobby-mode");
  ["dieA","dieB","dieC"].forEach(id=>{
    document.getElementById(id)?.classList.remove("rolling");
  });
}

/** 打开网页大厅：显示骰子 + 开始按钮，不自动开局 */
export function showLobby(){
  const overlay=document.getElementById("startOverlay");
  const caption=document.getElementById("startCaption");
  const btn=document.getElementById("lobbyStartBtn");
  if(!overlay)return;
  overlay.hidden=false;
  overlay.classList.add("lobby-mode");
  if(caption)caption.textContent="掷骰坐庄 · 点击开始";
  ["dieA","dieB","dieC"].forEach((id,i)=>{
    const die=document.getElementById(id);
    if(die){
      die.classList.remove("rolling");
      die.dataset.face=String(i+3); /* 静态展示 3/4/5 */
    }
  });
  if(btn)btn.hidden=false;
}

/**
 * 开局掷骰动画（3 颗）。返回三枚点数。
 * @param {{caption:string,resultCaption:(a:number,b:number,c:number)=>string}} opts
 */
export async function playDiceAnimation(opts={}){
  const overlay=document.getElementById("startOverlay");
  const dice=["dieA","dieB","dieC"].map(id=>document.getElementById(id));
  const caption=document.getElementById("startCaption");
  const btn=document.getElementById("lobbyStartBtn");
  if(!overlay||dice.some(d=>!d)||!caption)return {a:1,b:1,c:1};

  overlay.hidden=false;
  overlay.classList.remove("lobby-mode");
  if(btn)btn.hidden=true;
  caption.textContent=opts.caption||"掷骰中…";
  dice.forEach(die=>die.classList.add("rolling"));

  const rollMs=1100;
  const started=performance.now();
  while(performance.now()-started<rollMs){
    dice.forEach(die=>{
      die.dataset.face=String(1+Math.floor(Math.random()*6));
    });
    await wait(70);
  }

  const faces=dice.map(()=>1+Math.floor(Math.random()*6));
  dice.forEach((die,i)=>{
    die.dataset.face=String(faces[i]);
    die.classList.remove("rolling");
  });
  const [a,b,c]=faces;
  caption.textContent=typeof opts.resultCaption==="function"
    ?opts.resultCaption(a,b,c)
    :`骰点 ${a}+${b}+${c}=${a+b+c}`;
  await wait(900);
  return {a,b,c};
}

export async function flashDealCaption(text){
  const overlay=document.getElementById("startOverlay");
  const caption=document.getElementById("startCaption");
  const board=document.querySelector(".dice-board");
  if(!overlay||!caption)return;
  overlay.hidden=false;
  if(board)board.style.opacity="0.35";
  caption.textContent=text;
}

export function clearDealCaption(){
  const board=document.querySelector(".dice-board");
  if(board)board.style.opacity="";
  hideStartOverlay();
}
