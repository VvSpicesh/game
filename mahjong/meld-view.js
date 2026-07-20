/**
 * 副露来源方向与自家手牌展示顺序（纯函数，不写 DOM）
 */

/** 固定牌桌屏幕方位：0 下 1 左 2 上 3 右 */
const SEAT_BEARING=[
  {x:0,y:1},
  {x:-1,y:0},
  {x:0,y:-1},
  {x:1,y:0}
];

/**
 * 相对当前视角的来源方向箭头（屏幕几何，不硬写 playerIndex）
 * @param {number} viewerSeat 当前展示副露的玩家座位 0–3
 * @param {number|null|undefined} sourceSeat 供牌 / 放炮者座位
 * @returns {"↑"|"↓"|"←"|"→"|null}
 */
export function relativeSeatDirection(viewerSeat,sourceSeat){
  if(!Number.isInteger(viewerSeat)||viewerSeat<0||viewerSeat>3)return null;
  if(!Number.isInteger(sourceSeat)||sourceSeat<0||sourceSeat>3)return null;
  if(sourceSeat===viewerSeat)return null;

  const v=SEAT_BEARING[viewerSeat];
  const s=SEAT_BEARING[sourceSeat];
  const dx=s.x-v.x;
  const dy=s.y-v.y;

  if(Math.abs(dy)>Math.abs(dx)){
    if(dy<0)return "↑";
    if(dy>0)return "↓";
  }
  if(dx<0)return "←";
  if(dx>0)return "→";
  return null;
}

/**
 * 兼容旧存档：读取 meld.from，无效则 null
 * @param {object|null|undefined} meld
 * @returns {number|null}
 */
export function normalizeMeldFrom(meld){
  const from=meld?.from;
  if(!Number.isInteger(from)||from<0||from>3)return null;
  return from;
}

const RELATIVE_SEAT=["自己","上家","对家","下家"];

function relativeSeatName(viewerSeat,sourceSeat){
  if(!Number.isInteger(viewerSeat)||!Number.isInteger(sourceSeat))return "";
  const diff=(sourceSeat-viewerSeat+4)%4;
  return RELATIVE_SEAT[diff]||"";
}

/**
 * @param {object|null|undefined} meld
 * @param {number} ownerSeat 副露所属玩家
 */
export function meldDisplayInfo(meld,ownerSeat){
  const type=String(meld?.type||"");
  const from=normalizeMeldFrom(meld);
  const sourceLabel=from!=null?relativeSeatName(ownerSeat,from):"";

  if(type==="anGang"){
    return {arrow:null,badge:null,title:"暗杠",sourceLabel:""};
  }
  if(type==="buGang"){
    return {
      arrow:from!=null?relativeSeatDirection(ownerSeat,from):null,
      badge:"自摸补杠",
      title:"补杠",
      sourceLabel
    };
  }
  if(type==="peng"||type==="mingGang"){
    return {
      arrow:from!=null?relativeSeatDirection(ownerSeat,from):null,
      badge:null,
      title:type==="peng"?"碰":"杠",
      sourceLabel
    };
  }
  return {arrow:null,badge:null,title:type||"副露",sourceLabel:""};
}

/**
 * 自家手牌展示顺序：新摸牌固定最左，不改变 hand 数组。
 * @param {object[]} hand
 * @param {string|null|undefined} drawnTileId
 * @returns {{tile:object,tileIndex:number,isDraw:boolean}[]}
 */
export function buildSelfHandDisplayOrder(hand,drawnTileId){
  const list=Array.isArray(hand)?hand:[];
  if(!drawnTileId){
    return list.map((tile,tileIndex)=>({tile,tileIndex,isDraw:false}));
  }

  const drawIndex=list.findIndex(tile=>tile?.id===drawnTileId);
  if(drawIndex<0){
    return list.map((tile,tileIndex)=>({tile,tileIndex,isDraw:false}));
  }

  const items=[{tile:list[drawIndex],tileIndex:drawIndex,isDraw:true}];
  list.forEach((tile,tileIndex)=>{
    if(tileIndex!==drawIndex)items.push({tile,tileIndex,isDraw:false});
  });
  return items;
}
