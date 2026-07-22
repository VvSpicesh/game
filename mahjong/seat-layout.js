/**
 * 四向座位局部布局：以「自己在下方」为标准模型，经方向映射生成 CSS 变量。
 * 不旋转容器，仅配置 flex/grid 与尺寸边界。
 */

export const SEAT_LAYOUT={
  self:{
    playerIndex:0,
    axis:"horizontal",
    inward:"up",
    flexDirection:"column-reverse",
    // 自己视角左边 = 屏幕左；wrap-reverse 使新行向桌心（上）增长
    discardFlexDirection:"row",
    discardFlexWrap:"wrap-reverse",
    discardAlignContent:"flex-start",
    discardJustifyContent:"flex-start",
    meldGridFlow:"row",
    meldAlignContent:"end",
    meldJustifyContent:"center",
    meldAlignItems:"flex-end",
    tileRotate:"0deg",
    metrics:"horizontal",
    discardSlotSwap:false
  },
  opposite:{
    playerIndex:2,
    axis:"horizontal",
    inward:"down",
    flexDirection:"column",
    // 对家视角左边 = 屏幕右
    discardFlexDirection:"row-reverse",
    discardFlexWrap:"wrap",
    discardAlignContent:"flex-start",
    discardJustifyContent:"flex-start",
    meldGridFlow:"row",
    meldAlignContent:"start",
    meldJustifyContent:"center",
    meldAlignItems:"flex-end",
    tileRotate:"180deg",
    metrics:"horizontal",
    discardSlotSwap:false
  },
  left:{
    playerIndex:1,
    axis:"vertical",
    inward:"right",
    flexDirection:"row",
    // 上家视角左边 = 屏幕上
    discardFlexDirection:"column",
    discardFlexWrap:"wrap",
    discardAlignContent:"flex-start",
    discardJustifyContent:"flex-start",
    meldGridFlow:"column",
    meldAlignContent:"start",
    meldJustifyContent:"center",
    meldAlignItems:"center",
    tileRotate:"90deg",
    metrics:"vertical",
    discardSlotSwap:true
  },
  right:{
    playerIndex:3,
    axis:"vertical",
    inward:"left",
    flexDirection:"row-reverse",
    // 下家视角左边 = 屏幕下；wrap-reverse 使新列向桌心（左）增长
    discardFlexDirection:"column-reverse",
    discardFlexWrap:"wrap-reverse",
    discardAlignContent:"flex-start",
    discardJustifyContent:"flex-start",
    meldGridFlow:"column",
    meldAlignContent:"center",
    meldJustifyContent:"center",
    meldAlignItems:"center",
    tileRotate:"-90deg",
    metrics:"vertical",
    discardSlotSwap:true
  }
};

export const PLAYER_INDEX_TO_SIDE={
  0:"self",
  1:"left",
  2:"opposite",
  3:"right"
};

/** 象限边界（仅定位与 max 尺寸，逻辑来自同一模型） */
const SEAT_POSITION={
  self:{
    "--seat-local-top":"50%",
    "--seat-local-bottom":"calc(var(--self-hand-band) + max(4px, env(safe-area-inset-bottom, 0px)))",
    "--seat-local-left":"var(--seat-h-inset)",
    "--seat-local-right":"var(--seat-h-inset)",
    /* 固定 7 列，不用百分比再压窄 */
    "--seat-local-max-main":"var(--discard-center-max-w)",
    "--seat-local-max-cross":"none"
  },
  opposite:{
    "--seat-local-top":"calc(var(--band-top) + var(--meld-gap))",
    "--seat-local-bottom":"50%",
    "--seat-local-left":"var(--seat-h-inset)",
    "--seat-local-right":"var(--seat-h-inset)",
    "--seat-local-max-main":"var(--discard-center-max-w)",
    "--seat-local-max-cross":"none"
  },
  left:{
    "--seat-local-top":"calc(var(--band-top) + 8px)",
    "--seat-local-bottom":"calc(var(--self-hand-band) + max(4px, env(safe-area-inset-bottom, 0px)) + 8px)",
    "--seat-local-left":"var(--band-side)",
    "--seat-local-right":"50%",
    "--seat-local-max-main":"100%",
    "--seat-local-max-cross":"min(26%, var(--discard-side-max-w))"
  },
  right:{
    "--seat-local-top":"calc(var(--band-top) + 8px)",
    "--seat-local-bottom":"calc(var(--self-hand-band) + max(4px, env(safe-area-inset-bottom, 0px)) + 8px)",
    "--seat-local-left":"50%",
    "--seat-local-right":"var(--band-side)",
    "--seat-local-max-main":"100%",
    "--seat-local-max-cross":"min(26%, var(--discard-side-max-w))"
  }
};

const COMPACT_POSITION={
  self:{
    "--seat-local-top":"34%",
    "--seat-local-bottom":"24%",
    "--seat-local-left":"var(--seat-h-inset)",
    "--seat-local-right":"var(--seat-h-inset)",
    "--seat-local-max-main":"var(--discard-center-max-w)",
    "--seat-local-max-cross":"none"
  },
  opposite:{
    "--seat-local-top":"22%",
    "--seat-local-bottom":"50%",
    "--seat-local-left":"var(--seat-h-inset)",
    "--seat-local-right":"var(--seat-h-inset)",
    "--seat-local-max-main":"var(--discard-center-max-w)",
    "--seat-local-max-cross":"none"
  },
  left:{
    "--seat-local-top":"34%",
    "--seat-local-bottom":"36%",
    "--seat-local-left":"var(--band-side)",
    "--seat-local-right":"50%",
    "--seat-local-max-main":"100%",
    "--seat-local-max-cross":"min(26%, var(--discard-side-max-w))"
  },
  right:{
    "--seat-local-top":"34%",
    "--seat-local-bottom":"36%",
    "--seat-local-left":"50%",
    "--seat-local-right":"var(--band-side)",
    "--seat-local-max-main":"100%",
    "--seat-local-max-cross":"min(26%, var(--discard-side-max-w))"
  }
};

function isCompactLandscape(){
  return window.matchMedia("(orientation: landscape) and (max-height: 600px)").matches;
}

function applyMetrics(el,config,pos){
  const horizontal=config.metrics==="horizontal";
  if(horizontal){
    el.style.setProperty("--discard-max-w",pos["--seat-local-max-main"]);
    el.style.setProperty("--discard-max-h",pos["--seat-local-max-cross"]||"none");
    el.style.setProperty("--meld-max-w","100%");
    el.style.setProperty("--meld-max-h","var(--self-meld-band)");
  }else{
    el.style.setProperty("--discard-max-h",pos["--seat-local-max-main"]);
    el.style.setProperty("--discard-max-w",pos["--seat-local-max-cross"]);
    el.style.setProperty("--meld-max-h","100%");
    el.style.setProperty("--meld-max-w","max(var(--meld-rail), calc(var(--meld-th) + 28px))");
  }
}

function readPx(value){
  const num=Number.parseFloat(value||"0");
  return Number.isFinite(num)?num:0;
}

function measureOuterSize(el){
  if(!el)return{width:0,height:0};
  const rect=el.getBoundingClientRect();
  const style=getComputedStyle(el);
  const shadowSafe=8;
  return {
    width:rect.width+readPx(style.marginLeft)+readPx(style.marginRight)+shadowSafe,
    height:rect.height+readPx(style.marginTop)+readPx(style.marginBottom)+shadowSafe
  };
}

function applyMeldZoneCapacity(localEl,config){
  const zone=localEl.querySelector(".meld-zone");
  if(!zone)return;
  const groups=[...zone.querySelectorAll(".meld-group")];
  if(!groups.length)return;

  zone.style.removeProperty("--meld-grid-columns");
  zone.style.removeProperty("--meld-grid-rows");
  zone.style.removeProperty("--meld-zone-tile-scale");

  const isVertical=config.metrics==="vertical";
  const defaultGap=6;
  const minGap=2;
  zone.style.setProperty("--meld-flex-direction",isVertical?"column":"row");
  zone.style.setProperty("--meld-group-gap",`${defaultGap}px`);
  zone.style.setProperty("--meld-align-content",config.meldAlignContent||"start");
  zone.style.setProperty("--meld-justify-content",config.meldJustifyContent||"center");
  zone.style.setProperty("--meld-align-items",config.meldAlignItems||"flex-end");

  const localRect=localEl.getBoundingClientRect();
  const discardRect=localEl.querySelector(".discard-zone")?.getBoundingClientRect();
  const eventRect=localEl.querySelector(".event-anchor")?.getBoundingClientRect();
  const seatGap=readPx(getComputedStyle(localEl).gap);

  // 先按未缩放尺寸测量，再决定 gap / 统一缩牌
  void zone.offsetWidth;
  const groupSizes=groups.map(measureOuterSize);
  const maxGroup=groupSizes.reduce((acc,size)=>({
    width:Math.max(acc.width,size.width),
    height:Math.max(acc.height,size.height)
  }),{width:0,height:0});

  const usableCross=isVertical
    ?Math.max(
      maxGroup.width,
      localRect.width-(discardRect?.width||0)-(eventRect?.width||0)-seatGap*2
    )
    :Math.max(
      maxGroup.height,
      localRect.height-(discardRect?.height||0)-(eventRect?.height||0)-seatGap*2
    );
  const usableMain=Math.max(1,isVertical?localRect.height:localRect.width);
  const mains=groupSizes.map(size=>isVertical?size.height:size.width);
  const groupsMain=mains.reduce((sum,v)=>sum+v,0);
  const n=groups.length;

  let gap=defaultGap;
  let needed=groupsMain+gap*Math.max(0,n-1);
  if(n>1&&needed>usableMain){
    const roomForGaps=usableMain-groupsMain;
    if(roomForGaps>=minGap*(n-1)){
      gap=Math.max(minGap,roomForGaps/Math.max(1,n-1));
    }else{
      gap=minGap;
      const budget=Math.max(1,usableMain-gap*(n-1));
      const scale=Math.max(0.55,Math.min(1,budget/Math.max(1,groupsMain)));
      zone.style.setProperty("--meld-zone-tile-scale",String(Number(scale.toFixed(4))));
    }
  }
  zone.style.setProperty("--meld-group-gap",`${Math.round(gap*10)/10}px`);

  if(isVertical){
    zone.style.width="auto";
    zone.style.height="100%";
    zone.style.maxWidth=`${Math.round(usableCross)}px`;
    zone.style.maxHeight="100%";
  }else{
    zone.style.width="100%";
    zone.style.height="auto";
    zone.style.maxHeight=`${Math.round(usableCross)}px`;
    zone.style.maxWidth="100%";
  }
}

function applyConfigToSeatLocal(el,side,config,pos){
  el.dataset.seatSide=side;
  el.classList.toggle("seat-discard-slot-swap",Boolean(config.discardSlotSwap));

  el.style.setProperty("--seat-flex-direction",config.flexDirection);
  el.style.setProperty("--seat-align-items","center");
  el.style.setProperty("--meld-flex-direction",config.metrics==="vertical"?"column":"row");
  el.style.setProperty("--meld-align-content",config.meldAlignContent||"start");
  el.style.setProperty("--meld-justify-content",config.meldJustifyContent||"center");
  el.style.setProperty("--meld-align-items",config.meldAlignItems||"flex-end");
  el.style.setProperty("--discard-flex-direction",config.discardFlexDirection);
  el.style.setProperty("--discard-flex-wrap",config.discardFlexWrap);
  el.style.setProperty("--discard-align-content",config.discardAlignContent);
  el.style.setProperty("--discard-justify-content",config.discardJustifyContent);
  el.style.setProperty("--discard-tile-rotate",config.tileRotate);
  el.style.setProperty("--meld-tile-rotate",config.tileRotate);

  for(const[key,value]of Object.entries(pos)){
    el.style.setProperty(key,value);
  }
  applyMetrics(el,config,pos);
  el.style.setProperty(
    "--event-anchor-w",
    config.metrics==="horizontal"
      ?"clamp(180px,28vw,240px)"
      :"clamp(96px,12vw,140px)"
  );
}

export function applySeatLayoutToTable(table=document.querySelector(".table")){
  if(!table)return;
  const compact=isCompactLandscape();
  for(const[side,config]of Object.entries(SEAT_LAYOUT)){
    const el=table.querySelector(`#seat-local-${config.playerIndex}`);
    if(!el)continue;
    const pos=compact?COMPACT_POSITION[side]:SEAT_POSITION[side];
    applyConfigToSeatLocal(el,side,config,pos);
    applyMeldZoneCapacity(el,config);
  }
}

export function setLayoutDebug(enabled){
  document.body.classList.toggle("layout-debug",Boolean(enabled));
}

export function sideForPlayerIndex(index){
  return PLAYER_INDEX_TO_SIDE[index]||"self";
}

function overlapArea(a,b){
  if(!a||!b)return 0;
  const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
  const y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return Math.round(x*y);
}

/** 布局压力验收：输出四向区域矩形与重叠（含跨座位弃牌↔副露） */
export function auditSeatLayout(table=document.querySelector(".table")){
  const tr=table?.getBoundingClientRect();
  const centerX=tr?tr.left+tr.width/2:0;
  const sides=["self","left","opposite","right"];
  const meldRects={
    self:document.getElementById("meld-0")?.getBoundingClientRect()||null,
    left:document.getElementById("meld-1")?.getBoundingClientRect()||null,
    opposite:document.getElementById("meld-2")?.getBoundingClientRect()||null,
    right:document.getElementById("meld-3")?.getBoundingClientRect()||null
  };
  return sides.map((side)=>{
    const config=SEAT_LAYOUT[side];
    const i=config.playerIndex;
    const local=document.getElementById(`seat-local-${i}`);
    const discard=document.getElementById(`discard-${i}`);
    const meld=document.getElementById(`meld-${i}`);
    const event=document.getElementById(`event-anchor-${i}`);
    const lr=local?.getBoundingClientRect();
    const dr=discard?.getBoundingClientRect();
    const mr=meld?.getBoundingClientRect();
    const er=event?.getBoundingClientRect();
    const tiles=discard?[...discard.querySelectorAll(".discard-tile-wrap")]:[];
    const cols=new Set(tiles.map(t=>Math.round(t.getBoundingClientRect().left))).size;
    const rows=new Set(tiles.map(t=>Math.round(t.getBoundingClientRect().top))).size;
    const cs=discard?getComputedStyle(discard):null;
    const meldCs=meld?getComputedStyle(meld):null;
    const groups=meld?[...meld.querySelectorAll(".meld-group")]:[];
    const groupRects=groups.map(group=>group.getBoundingClientRect());
    const meldCols=new Set(groupRects.map(rect=>Math.round(rect.left))).size;
    const meldRows=new Set(groupRects.map(rect=>Math.round(rect.top))).size;
    const maxGroupWidth=Math.max(...groups.map(group=>measureOuterSize(group).width),0);
    const maxGroupHeight=Math.max(...groups.map(group=>measureOuterSize(group).height),0);
    const crossMeldOverlap={
      vsSelfMeld:overlapArea(dr,meldRects.self),
      vsOppositeMeld:overlapArea(dr,meldRects.opposite),
      vsLeftMeld:overlapArea(dr,meldRects.left),
      vsRightMeld:overlapArea(dr,meldRects.right)
    };
    return{
      side,
      playerIndex:i,
      boundary:lr?{left:Math.round(lr.left),right:Math.round(lr.right),top:Math.round(lr.top),bottom:Math.round(lr.bottom),width:Math.round(lr.width),height:Math.round(lr.height)}:null,
      discard:dr?{
        left:Math.round(dr.left),right:Math.round(dr.right),top:Math.round(dr.top),bottom:Math.round(dr.bottom),
        width:Math.round(dr.width),height:Math.round(dr.height),
        maxWidth:cs?.maxWidth,maxHeight:cs?.maxHeight,
        cols,rows,tiles:tiles.length,
        itemsPerLine:discard.dataset.discardCols||discard.dataset.discardRows||null,
        degrade:discard.dataset.discardDegrade||null,
        overflow:cs?.overflow||null
      }:null,
      meld:mr?{
        left:Math.round(mr.left),right:Math.round(mr.right),top:Math.round(mr.top),bottom:Math.round(mr.bottom),
        width:Math.round(mr.width),
        height:Math.round(mr.height),
        groupCount:groups.length,
        groupOuterWidth:Math.round(maxGroupWidth),
        groupOuterHeight:Math.round(maxGroupHeight),
        cols:meldCols,
        rows:meldRows,
        gridTemplateColumns:meldCs?.gridTemplateColumns||"",
        gridTemplateRows:meldCs?.gridTemplateRows||""
      }:null,
      event:er?{width:Math.round(er.width),height:Math.round(er.height)}:null,
      overlapDiscardMeld:overlapArea(dr,mr),
      overlapDiscardEvent:overlapArea(dr,er),
      overlapMeldEvent:overlapArea(mr,er),
      crossMeldOverlap,
      crossCenter:side==="left"?Boolean(dr&&dr.right>centerX+1):side==="right"?Boolean(dr&&dr.left<centerX-1):false
    };
  });
}
