import {renderGame,renderLog,renderExchange,showReaction,hideReaction,renderRoundReveal,hideRoundReveal,showPlayerEvent,showDiscardEvent,clearPlayerEvent,playDiceAnimation,flashDealCaption,clearDealCaption,hideStartOverlay,showLobby,showMissingSuitModal,hideMissingSuitModal} from "./render.js";
import {applySeatLayoutToTable,setLayoutDebug,auditSeatLayout} from "./seat-layout.js?v=0.15.7";
import {saveState,loadState,clearState} from "./storage.js";
import {loadRules,saveRules,loadLastDealer,saveLastDealer,loadNames,saveNames,defaultRules,mergeDeep,normalizeSettlementRules} from "./config.js";
import {tileName} from "./tiles.js";
import {canPlayerWin} from "./hu.js";
import {
  getLegalDiscardIndexes,
  isLegalDiscard,
  canClaimTileSuit,
  pickAiMissingSuit,
  emptyRoundSettlement,
  SUIT_LABEL
} from "./rules-guard.js";
import {
  loadSessionScores,
  saveSessionScores,
  ensureSessionClock,
  checkEyeWarn,
  formatPoints,
  settleSelfDraw,
  settleDiscardWins,
  settleMingGang,
  settleAnOrBuGang,
  settleFlowerPigs,
  settleReadyHands,
  roundSummary
} from "./score.js";
import {runRuleTests} from "./rule-tests.js";
import {getPlayerDisplayName} from "./player-name.js?v=0.14.46";
import {mountHeader} from "../shared/header.js";
import {
  initAudio,
  setAudioEnabled,
  isAudioSupported,
  speakTile,
  speakAction,
  speakWin,
  speakPhrase,
  stopSpeech,
  playDiceRattle,
  playDealRound,
  armAudioGestureUnlock,
  waitUntilSpeechIdle
} from "./audio.js";

function snapshotRules(source=rules){
  return normalizeSettlementRules(mergeDeep(defaultRules,source||{}));
}

let names=loadNames();
/* 相对自己：左=上家，上=对家，右=下家 */
const AI_THINK_MS=1000;
let rules=loadRules();
let state=loadState();
let aiTimer=null;
let aiSeq=0;
let exchangeSelection=[];
let openingSeq=0;

function wait(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function seatWho(playerIndex){
  return getPlayerDisplayName(playerIndex,0,state.players);
}

function playerCall(playerIndex){
  return getPlayerDisplayName(playerIndex,0,state.players);
}

function formatWinLine(playerIndex,fanName){
  return `${seatWho(playerIndex)} ${fanName}`;
}

/** 胡家主文案。点炮类不写「某人点炮」，避免像是胡家在放炮。 */
function formatWinHeadline(playerIndex,fanName,manner){
  if(manner==="点炮"||manner==="杠上炮"){
    return `${seatWho(playerIndex)} · ${fanName}`;
  }
  if(manner==="抢杠胡"){
    return `${seatWho(playerIndex)} 抢杠胡 · ${fanName}`;
  }
  return `${seatWho(playerIndex)} ${manner} · ${fanName}`;
}

function compatible(candidate){
  return Boolean(
    candidate &&
    candidate.version==="0.10" &&
    Array.isArray(candidate.players) &&
    candidate.players.length===4 &&
    candidate.players.every(p=>Array.isArray(p.hand)&&Array.isArray(p.melds)) &&
    Array.isArray(candidate.wall) &&
    Array.isArray(candidate.discards)
  );
}

if(!compatible(state)){
  clearState();
  state=createInitialState();
}else{
  if(!Number.isInteger(state.dealer)){
    state.dealer=Number.isInteger(state.turn)?state.turn:0;
    state.dealing=false;
  }
  if(!Array.isArray(state.scores)||state.scores.length!==4){
    state.scores=loadSessionScores();
  }
  if(!Array.isArray(state.roundDelta)||state.roundDelta.length!==4){
    state.roundDelta=[0,0,0,0];
  }
  if(!Array.isArray(state.scoreLog))state.scoreLog=[];
  state.players.forEach((player,index)=>{
    if(player&&names[index]&&player.name!==names[index])player.name=names[index];
    if(player&&player.missingSuit===undefined)player.missingSuit=null;
  });
  if(!state.roundSettlement)state.roundSettlement=emptyRoundSettlement();
  if(state.revealAllHands==null)state.revealAllHands=state.phase==="结束";
  state.activeRules=snapshotRules(state.activeRules||rules);
}

const ruleExchange=document.getElementById("ruleExchange");
const ruleGang=document.getElementById("ruleGang");
const ruleCapFan=document.getElementById("ruleCapFan");
ruleExchange.checked=rules.exchangeThree;
ruleGang.checked=rules.gangRain;

function syncCapFanUi(){
  if(!ruleCapFan)return;
  const cap=String(rules.settlementRules?.capFan||8);
  if([...ruleCapFan.options].some(o=>o.value===cap))ruleCapFan.value=cap;
  else ruleCapFan.value="8";
}

syncCapFanUi();
armAudioGestureUnlock();
mountHeader({
  el:"#ngHeader",
  mode:"game",
  title:"四川麻将",
  homeHref:"../index.html",
  onSoundChange(enabled){
    if(!isAudioSupported()){
      toast("当前浏览器不支持声音");
      return;
    }
    initAudio();
    setAudioEnabled(enabled);
    toast(enabled?"声音已开启":"声音已关闭");
  },
  onFullscreenError(){
    toast("当前浏览器无法进入全屏");
  }
});

ruleExchange.addEventListener("change",()=>{
  rules.exchangeThree=ruleExchange.checked;
  saveRules(rules);
});
ruleGang.addEventListener("change",()=>{
  rules.gangRain=ruleGang.checked;
  saveRules(rules);
});
ruleCapFan?.addEventListener("change",()=>{
  const cap=Number(ruleCapFan.value)||8;
  rules=normalizeSettlementRules({
    ...rules,
    settlementRules:{
      ...(rules.settlementRules||{}),
      capFan:cap,
      flowerPigFan:cap,
      noReadyFan:cap
    }
  });
  saveRules(rules);
  toast(`封顶已设为 ${cap} 番（新局生效）`);
});

function createInitialState(){
  const scores=loadSessionScores();
  return {
    version:"0.10",
    phase:"准备",
    wall:[],
    players:names.map(name=>({name,hand:[],won:false,melds:[],missingSuit:null})),
    turn:0,
    dealer:0,
    dealing:false,
    discards:[],
    logs:["欢迎来到 Nocturne Mahjong。"],
    drawnTileId:null,
    selectedTileIndex:null,
    activeRules:snapshotRules(rules),
    lastAction:null,
    lastDiscard:null,
    pendingGang:null,
    scores,
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };
}

function createWall(){
  const wall=[];
  for(const suit of ["w","t","b"]){
    for(let number=1;number<=9;number++){
      for(let copy=0;copy<4;copy++){
        wall.push({s:suit,n:number,id:`${suit}${number}-${copy}`});
      }
    }
  }
  for(let i=wall.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [wall[i],wall[j]]=[wall[j],wall[i]];
  }
  return wall;
}

function sortHand(hand){
  const order={w:0,t:1,b:2};
  hand.sort((a,b)=>order[a.s]-order[b.s]||a.n-b.n);
}

function sameTile(a,b){
  return a&&b&&a.s===b.s&&a.n===b.n;
}

function matchingIndexes(hand,tile){
  const result=[];
  hand.forEach((item,index)=>{if(sameTile(item,tile))result.push(index)});
  return result;
}

function cloneTile(tile){
  return {s:tile.s,n:tile.n,id:tile.id||`${tile.s}${tile.n}-${Math.random()}`};
}

function nextDealerSeat(){
  const last=loadLastDealer();
  return last<0?0:(last+1)%4;
}

function newGame(){
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  initAudio();
  document.getElementById("exchangeModal")?.classList.remove("show");
  clearWinUi();
  document.getElementById("roundEndModal")?.classList.remove("show");
  document.getElementById("newGameModal")?.classList.remove("show");
  document.getElementById("namesModal")?.classList.remove("show");
  hideRoundReveal();
  hideMissingSuitModal();
  rules=loadRules();
  names=loadNames();
  syncCapFanUi();

  const dealer=nextDealerSeat();
  saveLastDealer(dealer);

  const wall=createWall();
  const players=names.map(name=>({name,hand:[],won:false,melds:[],missingSuit:null}));

  const scores=loadSessionScores();
  state={
    version:"0.10",
    phase:"开局",
    wall,
    players,
    turn:dealer,
    dealer,
    dealing:false,
    eventSeq:1,
    discards:[],
    logs:[
      `新牌局开始。${seatWho(dealer)} 坐庄。`,
      `换三张：${rules.exchangeThree?"开启":"关闭"}；刮风下雨：${rules.gangRain?"开启":"关闭"}。`,
      `本局起始分：${scores.map((n,i)=>`${playerCall(i)} ${n}`).join(" / ")}。`
    ],
    drawnTileId:null,
    selectedTileIndex:null,
    activeRules:snapshotRules(rules),
    lastAction:null,
    lastDiscard:null,
    pendingGang:null,
    scores:[...scores],
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  ensureSessionClock();
  commit();
  runOpeningSequence();
}

async function runOpeningSequence(){
  const seq=++openingSeq;
  const dealer=state.dealer;

  playDiceRattle(1100);
  await playDiceAnimation({
    caption:"掷骰定庄…",
    resultCaption:(a,b,c)=>`点数 ${a}+${b}+${c}=${a+b+c} · ${seatWho(dealer)} 坐庄`
  });
  if(seq!==openingSeq||!state||state.phase!=="开局")return;

  await flashDealCaption("发牌中…");
  state.dealing=true;
  commit();

  for(let round=0;round<13;round++){
    if(seq!==openingSeq||state.phase!=="开局")return;
    playDealRound();
    for(let step=0;step<4;step++){
      const player=(dealer+step)%4;
      state.players[player].hand.push(state.wall.pop());
    }
    commit();
    await wait(70);
  }

  if(seq!==openingSeq||state.phase!=="开局")return;

  state.players.forEach(player=>sortHand(player.hand));
  state.dealing=false;
  state.phase=rules.exchangeThree?"换三张":"定缺";
  state.turn=dealer;
  state.logs.push("发牌完成。");
  clearDealCaption();
  commit();

  if(rules.exchangeThree)openExchange();
  else beginMissingSuitPhase();
}

function openExchange(){
  exchangeSelection=[];
  renderExchange(state.players[0].hand,exchangeSelection,toggleExchangeTile);
  document.getElementById("exchangeModal").classList.add("show");
}

function toggleExchangeTile(index){
  const pos=exchangeSelection.indexOf(index);
  if(pos>=0)exchangeSelection.splice(pos,1);
  else{
    if(exchangeSelection.length>=3)return toast("只能选择三张");
    exchangeSelection.push(index);
  }
  renderExchange(state.players[0].hand,exchangeSelection,toggleExchangeTile);
}

document.getElementById("exchangeConfirm").addEventListener("click",()=>{
  if(exchangeSelection.length!==3)return;

  const outgoing=exchangeSelection.sort((a,b)=>b-a).map(i=>state.players[0].hand.splice(i,1)[0]);
  const all=[outgoing];

  for(let p=1;p<4;p++){
    const chosen=chooseExchangeTiles(state.players[p].hand);
    all[p]=chosen.sort((a,b)=>b-a).map(i=>state.players[p].hand.splice(i,1)[0]);
  }

  for(let p=0;p<4;p++){
    state.players[p].hand.push(...all[(p+3)%4]);
    sortHand(state.players[p].hand);
  }

  state.logs.push("换三张完成。");
  state.phase="定缺";
  document.getElementById("exchangeModal").classList.remove("show");
  commit();
  beginMissingSuitPhase();
});

function beginMissingSuitPhase(){
  state.phase="定缺";
  state.players.forEach(p=>{p.missingSuit=null;});
  commit();
  showMissingSuitModal(state.players[0].hand,suit=>{
    confirmMissingSuits(suit);
  });
}

function confirmMissingSuits(humanSuit){
  if(!["w","t","b"].includes(humanSuit))return;
  state.players[0].missingSuit=humanSuit;
  for(let i=1;i<4;i++){
    state.players[i].missingSuit=pickAiMissingSuit(state.players[i].hand);
  }
  const line=state.players
    .map((p,i)=>`${playerCall(i)}缺${SUIT_LABEL[p.missingSuit]}`)
    .join(" · ");
  state.logs.push(`定缺完成：${line}。`);
  hideMissingSuitModal();
  state.phase="摸牌";
  state.turn=state.dealer;
  commit();
  scheduleAutoDraw();
}

function chooseExchangeTiles(hand){
  return hand.map((tile,index)=>({index,score:keepScore(tile,hand)}))
    .sort((a,b)=>a.score-b.score).slice(0,3).map(x=>x.index);
}

function cancelAiSchedule(){
  clearTimeout(aiTimer);
  aiSeq++;
}

function scheduleAfterSpeech(fn,delayMs=0){
  clearTimeout(aiTimer);
  const seq=++aiSeq;
  const run=()=>{
    waitUntilSpeechIdle().then(()=>{
      if(seq!==aiSeq)return;
      try{fn();}catch{/* ignore */}
    });
  };
  if(delayMs>0)aiTimer=setTimeout(run,delayMs);
  else run();
}

function scheduleAutoDraw(delay){
  if(state.phase!=="摸牌")return;
  scheduleAfterSpeech(autoDraw,delay??(state.turn===0?260:AI_THINK_MS));
}

function scheduleAiDiscard(delay){
  if(state.turn===0||state.phase!=="出牌")return;
  scheduleAfterSpeech(aiDiscard,delay??AI_THINK_MS);
}

function autoDraw(){
  if(state.phase!=="摸牌"||!state.wall.length){
    if(!state.wall.length)finalizeRound("牌墙摸完");
    return;
  }

  const player=state.players[state.turn];
  const tile=state.wall.pop();
  player.hand.push(tile);
  sortHand(player.hand);

  state.drawnTileId=tile.id;
  state.selectedTileIndex=null;
  state.logs.push(`${playerCall(state.turn)}摸牌。`);
  state.phase="出牌";

  const info=canPlayerWin(player,player.hand,player.melds,{
    gangFlower:state.lastAction?.type==="gang"&&state.lastAction.player===state.turn,
    lastTile:state.wall.length===0
  },state.activeRules);

  if(info.canWin){
    if(state.turn===0){
      commit();
      showReaction("可以胡牌","",[
        {label:"胡",tile,primary:true,run:()=>declareSelfWin(0,info)},
        {label:"过",run:()=>afterDrawActions()}
      ]);
      return;
    }

    declareSelfWin(state.turn,info);
    return;
  }

  afterDrawActions();
}

function afterDrawActions(){
  const player=state.players[state.turn];
  const concealed=findConcealedGang(player);
  const added=findAddedGang(player);

  if(state.activeRules.gangRain&&(concealed||added)){
    if(state.turn===0){
      const actions=[];
      if(concealed)actions.push({label:"暗杠",tile:concealed.tile,primary:true,run:()=>doConcealedGang(0,concealed)});
      if(added)actions.push({label:"补杠",tile:added.tile,primary:!concealed,run:()=>attemptAddedGang(0,added)});
      actions.push({label:"过",run:()=>{commit()}});
      commit();
      showReaction("可以杠牌","请选择操作",actions);
      return;
    }

    if(concealed){doConcealedGang(state.turn,concealed);return}
    if(added){attemptAddedGang(state.turn,added);return}
  }

  commit();
  if(state.turn!==0)scheduleAiDiscard();
}

function findConcealedGang(player){
  const map=new Map();
  player.hand.forEach(tile=>{
    if(!canClaimTileSuit(player,tile))return;
    const key=tile.s+tile.n;
    const entry=map.get(key)||{tile,count:0};
    entry.count++;
    map.set(key,entry);
  });
  return [...map.values()].find(x=>x.count===4)||null;
}

function findAddedGang(player){
  for(const meld of player.melds){
    if(meld.type!=="peng")continue;
    const tile=meld.tiles[0];
    if(!canClaimTileSuit(player,tile))continue;
    const index=player.hand.findIndex(item=>sameTile(item,tile));
    if(index>=0)return {meld,tile,index};
  }
  return null;
}

function handleTileClick(tileIndex){
  if(state.turn!==0||state.phase!=="出牌")return;
  if(!isLegalDiscard(state.players[0],tileIndex)){
    return toast("请先打完缺门牌");
  }
  if(state.selectedTileIndex===tileIndex){
    discard(0,tileIndex);
    return;
  }
  state.selectedTileIndex=tileIndex;
  commit();
}

function discard(playerIndex,tileIndex){
  const player=state.players[playerIndex];
  if(!isLegalDiscard(player,tileIndex)){
    if(playerIndex===0)toast("请先打完缺门牌");
    return;
  }
  const [tile]=player.hand.splice(tileIndex,1);

  const eventId=state.eventSeq++;
  state.discards.push({player:playerIndex,tile,eventId});
  state.lastDiscard={player:playerIndex,tile,eventId};
  state.logs.push(`${playerCall(playerIndex)}打出 ${tileName(tile)}。`);
  state.drawnTileId=null;
  state.selectedTileIndex=null;
  state.phase="等待操作";
  speakTile(tile);
  commit();

  resolveDiscard(tile,playerIndex);
}

function resolveDiscard(tile,fromPlayer){
  const candidates=activePlayersAfter(fromPlayer);
  const gangDiscard=state.lastAction?.type==="gang"&&state.lastAction.player===fromPlayer;
  const lastTile=state.wall.length===0;

  /* 先算好各家胡牌信息，结算时复用，避免再次判定失败导致某家 0 番 */
  const winChecks=candidates.map(index=>{
    const p=state.players[index];
    const info=canPlayerWin(
      p,
      p.hand.concat([cloneTile(tile)]),
      p.melds,
      {gangDiscard,lastTile},
      state.activeRules
    );
    return {index,info};
  }).filter(item=>item.info.canWin);

  if(winChecks.length){
    if(winChecks.some(item=>item.index===0)){
      showReaction("可以点炮胡","",[
        {label:"胡",tile,primary:true,run:()=>declareDiscardWins(winChecks,tile,fromPlayer)},
        {label:"过",run:()=>{
          const rest=winChecks.filter(item=>item.index!==0);
          if(rest.length)declareDiscardWins(rest,tile,fromPlayer);
          else resolveClaims(tile,fromPlayer,candidates.filter(i=>i!==0));
        }}
      ]);
      return;
    }

    declareDiscardWins(winChecks,tile,fromPlayer);
    return;
  }

  resolveClaims(tile,fromPlayer,candidates);
}

function resolveClaims(tile,fromPlayer,candidates){
  const humanMatches=matchingIndexes(state.players[0].hand,tile).length;
  const humanEligible=candidates.includes(0)&&canClaimTileSuit(state.players[0],tile);
  const canGang=state.activeRules.gangRain&&humanEligible&&humanMatches>=3;
  const canPeng=humanEligible&&humanMatches>=2;

  if(canGang||canPeng){
    const actions=[];
    if(canGang)actions.push({label:"明杠",tile,primary:true,run:()=>claimMingGang(0,tile,fromPlayer)});
    if(canPeng)actions.push({label:"碰",tile,primary:!canGang,run:()=>claimPeng(0,tile,fromPlayer)});
    actions.push({label:"过",run:()=>resolveAiClaims(tile,fromPlayer,candidates.filter(i=>i!==0))});

    showReaction("可以操作","请选择碰、杠或过",actions);
    return;
  }

  resolveAiClaims(tile,fromPlayer,candidates);
}

function resolveAiClaims(tile,fromPlayer,candidates){
  for(const index of candidates){
    if(index===0)continue;
    const player=state.players[index];
    if(!canClaimTileSuit(player,tile))continue;
    const matches=matchingIndexes(player.hand,tile).length;

    if(state.activeRules.gangRain&&matches>=3){
      claimMingGang(index,tile,fromPlayer);
      return;
    }

    if(matches>=2&&keepScore(tile,player.hand)>=9){
      claimPeng(index,tile,fromPlayer);
      return;
    }
  }

  nextTurnFrom(fromPlayer);
}

function claimPeng(playerIndex,tile,fromPlayer){
  const player=state.players[playerIndex];
  if(!canClaimTileSuit(player,tile)){
    if(playerIndex===0)toast("定缺花色不能碰");
    resolveAiClaims(tile,fromPlayer,activePlayersAfter(fromPlayer).filter(i=>i!==playerIndex));
    return;
  }
  const player2=player;
  removeMatching(player2,tile,2);
  const sourceEventId=state.lastDiscard?.eventId??null;
  removeLastDiscard();
  player2.melds.push({type:"peng",from:fromPlayer,tiles:Array.from({length:3},()=>cloneTile(tile))});
  state.turn=playerIndex;
  state.phase="出牌";
  state.drawnTileId=null;
  state.selectedTileIndex=null;
  state.lastAction={type:"peng",player:playerIndex};
  state.logs.push(`${playerCall(playerIndex)}碰 ${tileName(tile)}（${seatWho(fromPlayer)}打出）。`);
  commit();
  showPlayerEvent({
    playerIndex,
    type:"peng",
    title:"碰",
    sourceEventId,
    duration:1200
  });
  speakAction("碰");

  if(playerIndex!==0)scheduleAiDiscard();
}

function claimMingGang(playerIndex,tile,fromPlayer){
  const player=state.players[playerIndex];
  if(!canClaimTileSuit(player,tile)){
    if(playerIndex===0)toast("定缺花色不能杠");
    resolveAiClaims(tile,fromPlayer,activePlayersAfter(fromPlayer).filter(i=>i!==playerIndex));
    return;
  }
  removeMatching(player,tile,3);
  const sourceEventId=state.lastDiscard?.eventId??null;
  removeLastDiscard();
  player.melds.push({type:"mingGang",from:fromPlayer,tiles:Array.from({length:4},()=>cloneTile(tile))});
  state.turn=playerIndex;
  state.drawnTileId=null;
  state.selectedTileIndex=null;
  state.lastAction={type:"gang",player:playerIndex,kind:"mingGang"};
  const settled=settleMingGang(state,playerIndex,fromPlayer);
  state.logs.push(
    settled
      ?`${playerCall(playerIndex)}杠 ${tileName(tile)}（${seatWho(fromPlayer)}打出） · ${settled.logText}`
      :`${playerCall(playerIndex)}杠 ${tileName(tile)}（${seatWho(fromPlayer)}打出）。`
  );
  commit();
  showPlayerEvent({
    playerIndex,
    type:"mingGang",
    title:"杠",
    sourceEventId,
    duration:1500
  });
  speakAction("杠");
  drawSupplement(playerIndex);
}

function doConcealedGang(playerIndex,entry){
  const player=state.players[playerIndex];
  removeMatching(player,entry.tile,4);
  player.melds.push({type:"anGang",from:playerIndex,tiles:Array.from({length:4},()=>cloneTile(entry.tile))});
  state.turn=playerIndex;
  state.drawnTileId=null;
  state.selectedTileIndex=null;
  state.lastAction={type:"gang",player:playerIndex,kind:"anGang"};
  const settled=settleAnOrBuGang(state,playerIndex,"暗杠");
  state.logs.push(
    settled
      ?`${playerCall(playerIndex)}暗杠 ${tileName(entry.tile)} · ${settled.logText}`
      :`${playerCall(playerIndex)}暗杠 ${tileName(entry.tile)}。`
  );
  commit();
  showPlayerEvent({
    playerIndex,
    type:"anGang",
    title:"暗杠",
    duration:1500
  });
  speakAction("杠");
  drawSupplement(playerIndex);
}

function attemptAddedGang(playerIndex,entry){
  const tile=entry.tile;
  const robbers=activePlayersAfter(playerIndex).filter(index=>{
    const player=state.players[index];
    const test=player.hand.concat([cloneTile(tile)]);
    return canPlayerWin(player,test,player.melds,{robGang:true},state.activeRules).canWin;
  });

  if(robbers.length){
    if(robbers.includes(0)){
      showReaction("可以抢杠胡","",[
        {label:"胡",tile,primary:true,run:()=>declareRobGangWins(robbers,tile,playerIndex)},
        {label:"过",run:()=>completeAddedGang(playerIndex,entry)}
      ]);
      return;
    }

    declareRobGangWins(robbers,tile,playerIndex);
    return;
  }

  completeAddedGang(playerIndex,entry);
}

function completeAddedGang(playerIndex,entry){
  const player=state.players[playerIndex];
  player.hand.splice(entry.index,1);
  entry.meld.type="buGang";
  entry.meld.tiles.push(cloneTile(entry.tile));
  state.turn=playerIndex;
  state.drawnTileId=null;
  state.selectedTileIndex=null;
  state.lastAction={type:"gang",player:playerIndex,kind:"buGang"};
  const settled=settleAnOrBuGang(state,playerIndex,"补杠");
  state.logs.push(
    settled
      ?`${playerCall(playerIndex)}补杠 ${tileName(entry.tile)} · ${settled.logText}`
      :`${playerCall(playerIndex)}补杠 ${tileName(entry.tile)}。`
  );
  commit();
  showPlayerEvent({
    playerIndex,
    type:"buGang",
    title:"补杠",
    duration:1500
  });
  speakAction("杠");
  drawSupplement(playerIndex);
}

function drawSupplement(playerIndex){
  state.turn=playerIndex;
  state.phase="摸牌";
  commit();
  scheduleAutoDraw(320);
}

function markWinTile(player,tile){
  player.won=true;
  if(!tile){
    player.winTile=null;
    return;
  }
  player.winTile={s:tile.s,n:tile.n,id:tile.id};
  let index=player.hand.findIndex(item=>item.id===tile.id);
  if(index<0)index=player.hand.findIndex(item=>item.s===tile.s&&item.n===tile.n);
  if(index<0)return;
  const [moved]=player.hand.splice(index,1);
  player.hand.push(moved);
}

function winPatternName(info){
  let name=String(info?.name||info?.basePattern||"平胡").replace(/[·・]/g,"").trim()||"平胡";
  /* 口语更常说对对胡 */
  name=name.replace(/大对子/g,"对对胡");
  return name;
}

function speakCurrentWin({manner,winners,winInfos,from=null,fans=null}){
  speakWin({
    manner,
    winners,
    winInfos,
    patterns:(winInfos||[]).map(winPatternName),
    fans:fans??(winInfos||[]).map(info=>info?.totalFan),
    from
  });
}

/** AI 胡后自动续局定时器；新牌局 / 重开时清除 */
let huContinueTimer=null;

function clearHuContinue(){
  if(huContinueTimer!=null){
    clearTimeout(huContinueTimer);
    huContinueTimer=null;
  }
}

/** 新牌局 / 重开：清座位胡提示与续局定时器 */
function clearWinUi(){
  clearHuContinue();
  clearPlayerEvent();
}

/**
 * 仅座位小提示展示胡牌；自己胡需确认，纯 AI 3 秒后续局。
 * 一炮多响：各胡家各自一条，无中央汇总。
 */
function presentHuSeatTips({
  winners,
  winInfos,
  fans,
  deltas,
  continueFrom,
  title="胡",
  sourceEventId=null,
  winTile=null
}){
  cancelAiSchedule();
  clearHuContinue();

  const includesHuman=winners.includes(0);
  let continued=false;
  const finish=()=>{
    if(continued)return;
    continued=true;
    clearHuContinue();
    clearPlayerEvent();
    continueAfterWin(continueFrom);
  };

  winners.forEach((index,i)=>{
    const isHuman=index===0;
    const tile=winTile||state.players[index]?.winTile||null;
    showPlayerEvent({
      playerIndex:index,
      type:"hu",
      title,
      tile,
      pattern:winPatternName(winInfos[i]),
      fan:fans?.[i]??winInfos[i]?.totalFan,
      score:formatPoints(deltas[index]),
      sourceEventId:i===0?sourceEventId:null,
      duration:3000,
      blocking:includesHuman&&isHuman,
      onConfirm:includesHuman&&isHuman?finish:null
    });
  });

  if(!includesHuman){
    huContinueTimer=setTimeout(finish,3000);
  }
}

function declareSelfWin(playerIndex,info){
  const player=state.players[playerIndex];
  const winTile=
    player.hand.find(tile=>tile.id===state.drawnTileId)||
    player.hand[player.hand.length-1]||
    null;
  const afterGang=state.lastAction?.type==="gang"&&state.lastAction.player===playerIndex;
  const manner=afterGang?"杠上开花":"自摸";
  markWinTile(player,winTile);
  const settled=settleSelfDraw(state,playerIndex,info,{
    selfDraw:true,
    gangFlower:afterGang
  });
  state.logs.push(
    `${formatWinHeadline(playerIndex,info.name,manner)} · ${settled.fan}番 ${formatPoints(settled.deltas[playerIndex])}。`
  );
  state.lastAction={type:"win",player:playerIndex,kind:"self",manner};
  speakCurrentWin({
    manner,
    winners:[playerIndex],
    winInfos:[info],
    fans:[settled.fan]
  });
  commit();

  presentHuSeatTips({
    winners:[playerIndex],
    winInfos:[info],
    fans:[settled.fan],
    deltas:settled.deltas,
    winTile,
    continueFrom:playerIndex,
    title:afterGang?"杠上花":"自摸"
  });
}

function declareDiscardWins(winChecks,tile,fromPlayer){
  const sourceEventId=state.lastDiscard?.eventId??null;
  removeLastDiscard();
  const gangPaohu=state.lastAction?.type==="gang"&&state.lastAction.player===fromPlayer;
  const manner=gangPaohu?"杠上炮":"点炮";
  

  const checks=winChecks.map(item=>({
    index:item.index,
    info:item.info?.canWin?item.info:canPlayerWin(
      state.players[item.index],
      state.players[item.index].hand.concat([cloneTile(tile)]),
      state.players[item.index].melds,
      {gangDiscard:gangPaohu,lastTile:state.wall.length===0},
      state.activeRules
    )
  })).filter(item=>item.info.canWin);

  if(!checks.length){
    nextTurnFrom(fromPlayer);
    return;
  }

  checks.forEach(({index})=>{
    const player=state.players[index];
    const winTile=cloneTile(tile);
    player.hand.push(winTile);
    sortHand(player.hand);
    markWinTile(player,winTile);
  });

  const winners=checks.map(item=>item.index);
  const winInfos=checks.map(item=>item.info);
  const settled=settleDiscardWins(state,winners,fromPlayer,winInfos,{
    gangDiscard:gangPaohu
  });

  winners.forEach((index,i)=>{
    state.logs.push(
      `${formatWinHeadline(index,winInfos[i].name,manner)}（${seatWho(fromPlayer)} 放炮）`+
      ` · ${settled.fans[i]}番 ${formatPoints(settled.deltas[index])} · 胡 ${tileName(tile)}。`
    );
  });

  state.lastAction={type:"win",players:winners,kind:"discard",from:fromPlayer,manner};
  speakCurrentWin({
    manner,
    winners,
    winInfos,
    from:fromPlayer,
    fans:settled.fans
  });
  commit();

  presentHuSeatTips({
    winners,
    winInfos,
    fans:settled.fans,
    deltas:settled.deltas,
    winTile:tile,
    continueFrom:fromPlayer,
    title:gangPaohu?"杠上炮":"胡",
    sourceEventId
  });
}

function declareRobGangWins(winners,tile,fromPlayer){
  const winChecks=winners.map(index=>{
    const player=state.players[index];
    const info=canPlayerWin(
      player,
      player.hand.concat([cloneTile(tile)]),
      player.melds,
      {robGang:true},
      state.activeRules
    );
    return {index,info};
  }).filter(item=>item.info.canWin);

  if(!winChecks.length)return;

  winChecks.forEach(({index})=>{
    const player=state.players[index];
    const winTile=cloneTile(tile);
    player.hand.push(winTile);
    sortHand(player.hand);
    markWinTile(player,winTile);
  });

  const winnerIndexes=winChecks.map(item=>item.index);
  const winInfos=winChecks.map(item=>item.info);
  const settled=settleDiscardWins(state,winnerIndexes,fromPlayer,winInfos,{robGang:true});
  winnerIndexes.forEach((index,i)=>{
    state.logs.push(
      `${formatWinHeadline(index,winInfos[i].name,"抢杠胡")}（抢 ${seatWho(fromPlayer)}）`+
      ` · ${settled.fans[i]}番 ${formatPoints(settled.deltas[index])} · 胡 ${tileName(tile)}。`
    );
  });

  speakCurrentWin({
    manner:"抢杠胡",
    winners:winnerIndexes,
    winInfos,
    from:fromPlayer,
    fans:settled.fans
  });
  commit();

  presentHuSeatTips({
    winners:winnerIndexes,
    winInfos,
    fans:settled.fans,
    deltas:settled.deltas,
    winTile:tile,
    continueFrom:fromPlayer,
    title:"抢杠胡"
  });
}

function continueAfterWin(referencePlayer){
  const active=state.players.filter(p=>!p.won).length;
  if(active<=1||!state.wall.length){
    finalizeRound(active<=1?"三家已胡":"牌墙摸完");
    return;
  }
  nextTurnFrom(referencePlayer);
}

function nextTurnFrom(referencePlayer){
  let next=referencePlayer;
  do{
    next=(next+1)%4;
  }while(state.players[next].won);

  state.turn=next;
  state.phase="摸牌";
  state.lastAction=null;
  commit();
  scheduleAutoDraw();
}

function activePlayersAfter(fromPlayer){
  const result=[];
  for(let step=1;step<=3;step++){
    const index=(fromPlayer+step)%4;
    if(!state.players[index].won)result.push(index);
  }
  return result;
}

function removeMatching(player,tile,count){
  const indexes=matchingIndexes(player.hand,tile).slice(0,count).sort((a,b)=>b-a);
  indexes.forEach(index=>player.hand.splice(index,1));
}

function removeLastDiscard(){
  state.discards.pop();
  state.lastDiscard=null;
}

function aiDiscard(){
  if(state.turn===0||state.phase!=="出牌")return;
  const player=state.players[state.turn];
  const tileIndex=chooseDiscard(player.hand);
  discard(state.turn,tileIndex);
}

function chooseDiscard(hand){
  const player=state.players[state.turn];
  const legal=new Set(getLegalDiscardIndexes(player));
  const ranked=hand
    .map((tile,index)=>({index,score:keepScore(tile,hand),legal:legal.has(index)}))
    .filter(x=>x.legal)
    .sort((a,b)=>a.score-b.score);
  return (ranked[0]||{index:0}).index;
}

function keepScore(tile,hand){
  const same=hand.filter(t=>sameTile(t,tile)).length;
  const near1=hand.filter(t=>t.s===tile.s&&Math.abs(t.n-tile.n)===1).length;
  const near2=hand.filter(t=>t.s===tile.s&&Math.abs(t.n-tile.n)===2).length;
  return same*5+near1*3+near2;
}

/** 统一终局：花猪 → 查叫 → 流水 → 亮牌 → 展示 */
function finalizeRound(reason){
  state.phase="结束";
  state.revealAllHands=true;
  settleFlowerPigs(state);
  settleReadyHands(state);
  state.logs.push(`牌局结束：${reason}。`);
  if(Array.isArray(state.scores))saveSessionScores(state.scores);
  speakAction("牌局结束");
  commit();
  toast(`牌局结束：${reason}`);
  const summary=roundSummary(state,reason);
  const restart=()=>{
    cancelAiSchedule();
    clearState();
    newGame();
  };
  renderRoundReveal(state,state.roundSettlement,{
    onNewGame:restart,
    onClose:()=>{},
    reason,
    summary
  });
}

/** @deprecated 请用 finalizeRound；保留别名避免遗漏入口 */
function endRound(reason){
  finalizeRound(reason);
}

function commit(){
  saveState(state);
  renderGame(state,{onTileClick:handleTileClick});
  renderLog(state.logs);
}

function toast(message){
  const el=document.getElementById("toast");
  el.textContent=message;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer=setTimeout(()=>el.classList.remove("show"),1700);
}

function isLocalDevHost(){
  const host=location.hostname;
  return host==="localhost"||host==="127.0.0.1";
}

function pullTile(wall,suit,number){
  const index=wall.findIndex(tile=>tile.s===suit&&tile.n===number);
  if(index<0)throw new Error(`规则测试缺牌：${suit}${number}`);
  return wall.splice(index,1)[0];
}

function pullTiles(wall,suit,number,count){
  return Array.from({length:count},()=>pullTile(wall,suit,number));
}

function loadRuleTestScenario(){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  document.getElementById("exchangeModal")?.classList.remove("show");
  clearWinUi();
  document.getElementById("roundEndModal")?.classList.remove("show");
  document.getElementById("newGameModal")?.classList.remove("show");
  hideRoundReveal();

  rules.gangRain=true;
  ruleGang.checked=true;
  saveRules(rules);

  const wall=createWall();
  const scoresBefore=loadSessionScores().slice();

  /** 四家 2暗杠+2碰；牌种互不重叠，每种≤4张 */
  const meldPlans=[
    // 自己：暗杠一万/九万，碰二条/八筒
    {gangs:[["w",1],["w",9]],pengs:[["t",2],["b",8]],pengFrom:3},
    // 上家：暗杠二万/八万，碰三条/七筒
    {gangs:[["w",2],["w",8]],pengs:[["t",3],["b",7]],pengFrom:0},
    // 对家：暗杠三万/七万，碰四条/六筒
    {gangs:[["w",3],["w",7]],pengs:[["t",4],["b",6]],pengFrom:1},
    // 下家：暗杠四万/六万，碰五条/五筒
    {gangs:[["w",4],["w",6]],pengs:[["t",5],["b",5]],pengFrom:2}
  ];

  function makeAnGang(owner,suit,num){
    return{
      type:"anGang",
      from:owner,
      debugPreset:true,
      tiles:pullTiles(wall,suit,num,4)
    };
  }
  function makePeng(owner,from,suit,num){
    return{
      type:"peng",
      from,
      debugPreset:true,
      tiles:pullTiles(wall,suit,num,3)
    };
  }
  function meldsForSeat(owner){
    const plan=meldPlans[owner];
    return[
      makeAnGang(owner,plan.gangs[0][0],plan.gangs[0][1]),
      makeAnGang(owner,plan.gangs[1][0],plan.gangs[1][1]),
      makePeng(owner,plan.pengFrom,plan.pengs[0][0],plan.pengs[0][1]),
      makePeng(owner,plan.pengFrom,plan.pengs[1][0],plan.pengs[1][1])
    ];
  }

  const melds0=meldsForSeat(0);
  const melds1=meldsForSeat(1);
  const melds2=meldsForSeat(2);
  const melds3=meldsForSeat(3);

  // 手牌：每家2张；自己再摸1张进入出牌（共3张）
  const hand0=[pullTile(wall,"w",5),pullTile(wall,"t",1)];
  const drawn=pullTile(wall,"t",6);
  hand0.push(drawn);
  const hand1=[pullTile(wall,"b",1),pullTile(wall,"b",2)];
  const hand2=[pullTile(wall,"t",7),pullTile(wall,"t",8)];
  const hand3=[pullTile(wall,"b",3),pullTile(wall,"b",4)];

  // 少量弃牌，便于验收副露↔弃牌/飘字层级（用剩余牌墙，不碰副露牌种）
  const discards=[];
  let eventId=1;
  for(let seat=0;seat<4;seat++){
    for(let i=0;i<6;i++){
      if(!wall.length)break;
      discards.push({player:seat,tile:wall.pop(),eventId:eventId++});
    }
  }

  [hand0,hand1,hand2,hand3].forEach(sortHand);

  function suitAbsent(hand,melds){
    const used=new Set([...(hand||[]),...((melds||[]).flatMap(m=>m.tiles||[]))].map(t=>t.s));
    return ["w","t","b"].find(s=>!used.has(s))||"w";
  }

  state={
    version:"0.10",
    phase:"出牌",
    turn:0,
    dealer:0,
    dealing:false,
    wall,
    eventSeq:eventId,
    discards,
    lastDiscard:discards.length?discards[discards.length-1]:null,
    lastAction:null,
    pendingGang:null,
    drawnTileId:drawn.id,
    selectedTileIndex:null,
    players:[
      {name:names[0],hand:hand0,melds:melds0,won:false,missingSuit:suitAbsent(hand0,melds0)},
      {name:names[1],hand:hand1,melds:melds1,won:false,missingSuit:suitAbsent(hand1,melds1)},
      {name:names[2],hand:hand2,melds:melds2,won:false,missingSuit:suitAbsent(hand2,melds2)},
      {name:names[3],hand:hand3,melds:melds3,won:false,missingSuit:suitAbsent(hand3,melds3)}
    ],
    logs:["【碰杠场景】四家各 2暗杠+2碰 · UI布局极限（debugPreset，不结算杠分）"],
    activeRules:snapshotRules({...rules,exchangeThree:false,gangRain:true}),
    scores:scoresBefore,
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  setLayoutDebug(true);
  commit();
  fillPengGangSceneEvents();
  applySeatLayoutToTable();
  const audit=auditPengGangScene();
  console.log("[peng-gang scene]",audit);
  toast("碰杠场景已加载（四家2暗杠+2碰）");
  return audit;
}

function fillPengGangSceneEvents(){
  const sampleTile={s:"b",n:9,id:"debug-float-b9"};
  for(let i=0;i<4;i++){
    showPlayerEvent({
      playerIndex:i,
      action:"discard",
      tile:sampleTile,
      players:state.players,
      showSelfDiscard:true,
      duration:2800
    });
  }
}

function auditPengGangScene(){
  const idSet=new Set();
  let idDup=false;
  const countByKey=Object.create(null);
  const seats=state.players.map((player,index)=>{
    const zone=document.getElementById(`meld-${index}`);
    const groups=[...(zone?.querySelectorAll(".meld-group")||[])];
    const zoneCs=zone?getComputedStyle(zone):null;
    const melds=player.melds||[];
    melds.forEach(meld=>{
      (meld.tiles||[]).forEach(tile=>{
        if(idSet.has(tile.id))idDup=true;
        idSet.add(tile.id);
        const key=`${tile.s}${tile.n}`;
        countByKey[key]=(countByKey[key]||0)+1;
      });
    });
    (player.hand||[]).forEach(tile=>{
      if(idSet.has(tile.id))idDup=true;
      idSet.add(tile.id);
      const key=`${tile.s}${tile.n}`;
      countByKey[key]=(countByKey[key]||0)+1;
    });
    const rects=groups.map(g=>g.getBoundingClientRect());
    let groupOverlap=false;
    for(let i=0;i<rects.length;i++){
      for(let j=i+1;j<rects.length;j++){
        const a=rects[i],b=rects[j];
        const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
        const y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        if(x*y>1)groupOverlap=true;
      }
    }
    const wraps=[...zone?.querySelectorAll(".meld-tile-wrap")||[]];
    const sizes=wraps.map(w=>{
      const r=w.getBoundingClientRect();
      return{w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10};
    });
    const sizeOk=!sizes.length||sizes.every(s=>s.w===sizes[0].w&&s.h===sizes[0].h);
    const isVertical=index===1||index===3;
    const singleRow=isVertical
      ?new Set(rects.map(r=>Math.round(r.left))).size<=1
      :new Set(rects.map(r=>Math.round(r.top))).size<=1;
    return{
      index,
      meldCount:melds.length,
      groupCount:groups.length,
      types:melds.map(m=>m.type),
      preset:melds.every(m=>m.debugPreset===true),
      tileCounts:melds.map(m=>(m.tiles||[]).length),
      flexWrap:zoneCs?.flexWrap||null,
      groupOverlap,
      sizeOk,
      singleRow
    };
  });
  (state.discards||[]).forEach(d=>{
    const tile=d.tile;
    if(!tile)return;
    if(idSet.has(tile.id))idDup=true;
    idSet.add(tile.id);
    const key=`${tile.s}${tile.n}`;
    countByKey[key]=(countByKey[key]||0)+1;
  });
  const over4=Object.entries(countByKey).filter(([,c])=>c>4).map(([k,c])=>({tile:k,count:c}));
  const layout=auditSeatLayout();
  const discardMeldOverlap=layout.some(row=>{
    const o=row.crossMeldOverlap||{};
    return(o.vsSelfMeld||0)+(o.vsOppositeMeld||0)+(o.vsLeftMeld||0)+(o.vsRightMeld||0)>0;
  });
  const gangPayments=(state.roundSettlement?.gangPayments||[]).length;
  const scoresNow=state.scores||[];
  const scoresUnchanged=scoresNow.length===4; // 本场景不改 session 分；仅核对未写杠流水
  return{
    seats,
    idDup,
    over4,
    gangPayments,
    scoresUnchanged,
    discardMeldOverlap,
    ok:
      !idDup&&
      over4.length===0&&
      gangPayments===0&&
      seats.every(s=>
        s.meldCount===4&&
        s.groupCount===4&&
        s.preset&&
        s.flexWrap==="nowrap"&&
        !s.groupOverlap&&
        s.sizeOk&&
        s.singleRow&&
        s.types[0]==="anGang"&&
        s.types[1]==="anGang"&&
        s.types[2]==="peng"&&
        s.types[3]==="peng"&&
        s.tileCounts[0]===4&&
        s.tileCounts[1]===4&&
        s.tileCounts[2]===3&&
        s.tileCounts[3]===3
      )
  };
}

function fourMeldsForSeat(wall,fromPlayer,baseSuit,baseNum){
  return [
    {type:"peng",from:fromPlayer,tiles:pullTiles(wall,baseSuit,baseNum,3)},
    {type:"peng",from:fromPlayer,tiles:pullTiles(wall,baseSuit,baseNum+1,3)},
    {type:"peng",from:fromPlayer,tiles:pullTiles(wall,baseSuit,baseNum+2,3)},
    {type:"mingGang",from:fromPlayer,tiles:pullTiles(wall,baseSuit,baseNum+3,4)}
  ];
}

function stressMeldsForSeat(fromPlayer,baseSuit,baseNum){
  const mk=(n,count)=>Array.from({length:count},(_,i)=>cloneTile({
    s:baseSuit,n,id:`stress-m${fromPlayer}-${baseSuit}${n}-${i}`
  }));
  return [
    {type:"peng",from:fromPlayer,tiles:mk(baseNum,3)},
    {type:"peng",from:fromPlayer,tiles:mk(baseNum+1,3)},
    {type:"peng",from:fromPlayer,tiles:mk(baseNum+2,3)},
    {type:"mingGang",from:fromPlayer,tiles:mk(baseNum+3,4)}
  ];
}

function stressPengMeldsForSeat(fromPlayer,baseSuit,baseNum){
  const mk=(n)=>Array.from({length:3},(_,i)=>cloneTile({
    s:baseSuit,n,id:`stress-p${fromPlayer}-${baseSuit}${n}-${i}`
  }));
  return [
    {type:"peng",from:fromPlayer,tiles:mk(baseNum)},
    {type:"peng",from:fromPlayer,tiles:mk(baseNum+1)},
    {type:"peng",from:fromPlayer,tiles:mk(baseNum+2)},
    {type:"peng",from:fromPlayer,tiles:mk(baseNum+3)}
  ];
}

function stressTwoPengTwoGangForSeat(fromPlayer,baseSuit,baseNum){
  const mk=(n,count)=>Array.from({length:count},(_,i)=>cloneTile({
    s:baseSuit,n,id:`stress-mix${fromPlayer}-${baseSuit}${n}-${i}`
  }));
  return [
    {type:"peng",from:fromPlayer,tiles:mk(baseNum,3)},
    {type:"peng",from:fromPlayer,tiles:mk(baseNum+1,3)},
    {type:"mingGang",from:fromPlayer,tiles:mk(baseNum+2,4)},
    {type:"buGang",from:fromPlayer,tiles:mk(baseNum+3,4)}
  ];
}

function discardsForPlayer(playerIndex,count){
  const suits=["w","t","b"];
  return Array.from({length:count},(_,i)=>({
    player:playerIndex,
    tile:cloneTile({s:suits[i%3],n:(i%9)+1,id:`stress-d${playerIndex}-${i}`}),
    eventId:i+1+playerIndex*100
  }));
}

/** localhost：弃牌/副露布局压力（各 4 组副露 + 18 张弃牌） */
function loadLayoutStressScenario(variant="mixed"){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  document.getElementById("exchangeModal").classList.remove("show");
  clearWinUi();
  document.getElementById("roundEndModal").classList.remove("show");
  hideRoundReveal();

  const wall=createWall();
  const hand0=[
    cloneTile({s:"w",n:7,id:"stress-h0-1"}),
    cloneTile({s:"w",n:8,id:"stress-h0-2"}),
    cloneTile({s:"w",n:9,id:"stress-h0-3"})
  ];
  const hand1=[
    cloneTile({s:"t",n:7,id:"stress-h1-1"}),
    cloneTile({s:"t",n:8,id:"stress-h1-2"})
  ];
  const hand2=[
    cloneTile({s:"b",n:7,id:"stress-h2-1"}),
    cloneTile({s:"b",n:8,id:"stress-h2-2"}),
    cloneTile({s:"b",n:9,id:"stress-h2-3"})
  ];
  const hand3=[
    cloneTile({s:"b",n:6,id:"stress-h3-1"}),
    cloneTile({s:"t",n:9,id:"stress-h3-2"})
  ];

  const discards=[
    ...discardsForPlayer(0,18),
    ...discardsForPlayer(1,18),
    ...discardsForPlayer(2,18),
    ...discardsForPlayer(3,18)
  ];
  const lastDiscard=discards[discards.length-1]||null;

  function suitAbsent(hand,melds){
    const used=new Set([...(hand||[]),...((melds||[]).flatMap(m=>m.tiles||[]))].map(t=>t.s));
    return ["w","t","b"].find(s=>!used.has(s))||"w";
  }

  const buildVariant=(seat,fromPlayer,suit,baseNum)=>{
    if(variant==="four-peng-left-right"&&(seat===1||seat===3)){
      return stressPengMeldsForSeat(fromPlayer,suit,baseNum);
    }
    if(variant==="two-peng-two-gang-left-right"&&(seat===1||seat===3)){
      return stressTwoPengTwoGangForSeat(fromPlayer,suit,baseNum);
    }
    return stressMeldsForSeat(fromPlayer,suit,baseNum);
  };

  const melds0=buildVariant(0,2,"w",1);
  const melds1=buildVariant(1,0,"t",1);
  const melds2=buildVariant(2,0,"b",1);
  const melds3=buildVariant(3,0,"w",5);

  state={
    version:"0.10",
    phase:"摸牌",
    turn:0,
    dealer:0,
    dealing:false,
    wall,
    eventSeq:1,
    discards,
    lastDiscard,
    lastAction:null,
    pendingGang:null,
    drawnTileId:null,
    selectedTileIndex:null,
    players:[
      {name:names[0],hand:hand0,melds:melds0,won:false,missingSuit:suitAbsent(hand0,melds0)},
      {name:names[1],hand:hand1,melds:melds1,won:false,missingSuit:suitAbsent(hand1,melds1)},
      {name:names[2],hand:hand2,melds:melds2,won:false,missingSuit:suitAbsent(hand2,melds2)},
      {name:names[3],hand:hand3,melds:melds3,won:false,missingSuit:suitAbsent(hand3,melds3)}
    ],
    logs:[`【布局压力】${variant} · 四家各 4 组副露 + 18 张弃牌。`],
    activeRules:snapshotRules({...rules,exchangeThree:false,gangRain:true}),
    scores:loadSessionScores(),
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  [hand0,hand1,hand2,hand3].forEach(sortHand);
  setLayoutDebug(true);
  commit();
  fillLayoutStressEventAnchors();
  applySeatLayoutToTable();
  const audit=auditSeatLayout();
  console.log("[layout-stress audit]",audit);
  toast("布局压力场景已加载");
}

/** localhost：暗杠副露显示验收（1–9） */
function anGangTiles(suit,num,tag){
  return Array.from({length:4},(_,i)=>cloneTile({s:suit,n:num,id:`ag-${tag}-${suit}${num}-${i}`}));
}
function anGangMeld(suit,num,tag){
  return {type:"anGang",from:0,tiles:anGangTiles(suit,num,tag)};
}
function mingGangMeld(suit,num,from,tag){
  return {
    type:"mingGang",
    from,
    tiles:Array.from({length:4},(_,i)=>cloneTile({s:suit,n:num,id:`mg-${tag}-${suit}${num}-${i}`}))
  };
}
function pengMeld(suit,num,from,tag){
  return {
    type:"peng",
    from,
    tiles:Array.from({length:3},(_,i)=>cloneTile({s:suit,n:num,id:`pg-${tag}-${suit}${num}-${i}`}))
  };
}

function loadAnGangDisplayScenario(caseId=2){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  document.getElementById("exchangeModal")?.classList.remove("show");
  clearWinUi();
  document.getElementById("roundEndModal")?.classList.remove("show");
  hideRoundReveal();

  const id=Number(caseId)||2;
  const names=loadNames();
  const empty=[[],[],[],[]];
  const melds=empty.map(()=>[]);
  let label=`case ${id}`;

  if(id===1){
    melds[0]=[anGangMeld("w",1,"c1")];
    label="一个暗杠";
  }else if(id===2||id===9){
    melds[0]=[anGangMeld("w",1,"c2a"),anGangMeld("t",2,"c2b")];
    label=id===9?"自己两个暗杠":"两个暗杠";
  }else if(id===3){
    melds[0]=[anGangMeld("w",1,"c3a"),anGangMeld("t",2,"c3b"),anGangMeld("b",3,"c3c")];
    label="三个暗杠";
  }else if(id===4){
    melds[0]=[anGangMeld("w",1,"c4a"),mingGangMeld("t",5,1,"c4b")];
    label="一个暗杠 + 一个明杠";
  }else if(id===5){
    melds[0]=[anGangMeld("w",1,"c5a"),anGangMeld("t",2,"c5b"),pengMeld("b",3,3,"c5c")];
    label="两个暗杠 + 一个碰";
  }else if(id===6){
    melds[2]=[anGangMeld("w",1,"c6a"),anGangMeld("t",2,"c6b")];
    label="上家两个暗杠";
  }else if(id===7){
    melds[1]=[anGangMeld("w",1,"c7a"),anGangMeld("t",2,"c7b")];
    label="左家两个暗杠";
  }else if(id===8){
    melds[3]=[anGangMeld("w",1,"c8a"),anGangMeld("t",2,"c8b")];
    label="右家两个暗杠";
  }else{
    melds[0]=[anGangMeld("w",1,"c2a"),anGangMeld("t",2,"c2b")];
    label="两个暗杠";
  }

  const hand0=[
    cloneTile({s:"w",n:7,id:"ag-h0-1"}),
    cloneTile({s:"w",n:8,id:"ag-h0-2"}),
    cloneTile({s:"w",n:9,id:"ag-h0-3"})
  ];
  const hand1=[cloneTile({s:"t",n:7,id:"ag-h1-1"}),cloneTile({s:"t",n:8,id:"ag-h1-2"})];
  const hand2=[cloneTile({s:"b",n:7,id:"ag-h2-1"}),cloneTile({s:"b",n:8,id:"ag-h2-2"})];
  const hand3=[cloneTile({s:"b",n:6,id:"ag-h3-1"}),cloneTile({s:"t",n:9,id:"ag-h3-2"})];

  state={
    dealer:0,
    turn:0,
    phase:"出牌",
    wall:createWall(),
    discards:[],
    lastDiscard:null,
    lastAction:null,
    pendingGang:null,
    drawnTileId:null,
    selectedTileIndex:null,
    players:[
      {name:names[0],hand:hand0,melds:melds[0],won:false,missingSuit:"b"},
      {name:names[1],hand:hand1,melds:melds[1],won:false,missingSuit:"w"},
      {name:names[2],hand:hand2,melds:melds[2],won:false,missingSuit:"w"},
      {name:names[3],hand:hand3,melds:melds[3],won:false,missingSuit:"w"}
    ],
    logs:[`【暗杠显示】${label}`],
    activeRules:snapshotRules({...rules,exchangeThree:false,gangRain:true}),
    scores:loadSessionScores(),
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  [hand0,hand1,hand2,hand3].forEach(sortHand);
  setLayoutDebug(true);
  commit();
  applySeatLayoutToTable();
  const audit=auditAnGangDisplay();
  console.log("[an-gang display]",id,label,audit);
  toast(`暗杠显示：${label}`);
  return audit;
}

function auditAnGangDisplay(){
  const seats=[0,1,2,3].map(index=>{
    const zone=document.getElementById(`meld-${index}`);
    const groups=[...(zone?.querySelectorAll(".meld-group")||[])];
    const anGroups=groups.filter(g=>g.classList.contains("meld-an-gang")||g.classList.contains("meld-type-anGang"));
    const zoneStyle=zone?getComputedStyle(zone):null;
    const rects=anGroups.map(g=>g.getBoundingClientRect());
    let overlap=false;
    for(let i=0;i<rects.length;i++){
      for(let j=i+1;j<rects.length;j++){
        const a=rects[i],b=rects[j];
        const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
        const y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        if(x*y>1)overlap=true;
      }
    }
    const wraps=anGroups.flatMap(g=>[...g.querySelectorAll(".meld-tile-wrap")]);
    const sizes=wraps.map(w=>{
      const r=w.getBoundingClientRect();
      return {w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10};
    });
    const sizeOk=sizes.length<=1||sizes.every(s=>s.w===sizes[0].w&&s.h===sizes[0].h);
    const faces=anGroups.map(g=>[...g.querySelectorAll(".meld-tile-wrap .tile")].map(el=>el.classList.contains("tile-back")?"back":"show"));
    return {
      index,
      groupCount:groups.length,
      anGangCount:anGroups.length,
      tilesPerAn:anGroups.map(g=>g.querySelectorAll(".meld-tile-wrap").length),
      faces,
      flexWrap:zoneStyle?.flexWrap||null,
      overlap,
      sizeOk,
      sizes:sizes.slice(0,4)
    };
  });
  return {seats,ok:seats.every(s=>!s.overlap&&s.sizeOk&&s.flexWrap==="nowrap")};
}

function fillLayoutStressEventAnchors(){
  const labels=["自己","上家","对家","下家"];
  for(let i=0;i<4;i++){
    const anchor=document.getElementById(`event-anchor-${i}`);
    if(!anchor)continue;
    anchor.innerHTML=[
      `<div class="player-event-toast player-event-claim is-show layout-stress-event">`,
      `<div class="player-event-main player-event-main-inline">`,
      `<span class="player-event-name">${labels[i]}</span>`,
      `<span class="player-event-action">碰</span>`,
      `<span class="player-event-tile-name">一万</span>`,
      `</div></div>`
    ].join("");
  }
}

/**
 * 固定终局场景：自己未下叫 / 上家花猪 / 对家已下叫 / 下家已胡
 * 直接走 finalizeRound，便于验收亮牌与处罚。
 */
function loadEndRoundScenario(){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  document.getElementById("exchangeModal")?.classList.remove("show");
  clearWinUi();
  document.getElementById("roundEndModal")?.classList.remove("show");
  document.getElementById("newGameModal")?.classList.remove("show");
  hideRoundReveal();

  const wall=createWall();

  // 自己：散牌未听，缺万且无万 → 未下叫
  const hand0=[
    pullTile(wall,"t",1),pullTile(wall,"t",3),pullTile(wall,"t",5),
    pullTile(wall,"t",7),pullTile(wall,"t",9),
    pullTile(wall,"b",1),pullTile(wall,"b",3),pullTile(wall,"b",5),
    pullTile(wall,"b",7),pullTile(wall,"b",9),
    pullTile(wall,"t",2),pullTile(wall,"t",4),pullTile(wall,"t",6)
  ];

  // 上家：仍持缺门万 → 花猪（默认不叠未下叫）
  const hand1=[
    pullTile(wall,"w",9),
    pullTile(wall,"t",1),pullTile(wall,"t",3),pullTile(wall,"t",5),
    pullTile(wall,"b",2),pullTile(wall,"b",4),pullTile(wall,"b",6),
    pullTile(wall,"b",8),pullTile(wall,"t",8),
    pullTile(wall,"w",2),pullTile(wall,"w",4),pullTile(wall,"w",6),pullTile(wall,"w",8)
  ];

  // 对家：听 5 筒（清条筒牌型），缺万 → 已下叫
  const hand2=[
    pullTile(wall,"t",1),pullTile(wall,"t",2),pullTile(wall,"t",3),
    pullTile(wall,"t",4),pullTile(wall,"t",5),pullTile(wall,"t",6),
    pullTile(wall,"t",7),pullTile(wall,"t",8),pullTile(wall,"t",9),
    ...pullTiles(wall,"b",1,3),
    pullTile(wall,"b",5)
  ];

  // 下家：已胡，亮出胡牌
  const winTile=pullTile(wall,"b",9);
  const hand3=[
    ...pullTiles(wall,"w",1,3),
    ...pullTiles(wall,"w",3,3),
    ...pullTiles(wall,"w",5,3),
    ...pullTiles(wall,"b",7,3),
    pullTile(wall,"b",9),
    winTile
  ];

  [hand0,hand1,hand2,hand3].forEach(sortHand);
  wall.length=0;

  const scores=loadSessionScores();
  state={
    version:"0.10",
    phase:"结束",
    turn:0,
    dealer:0,
    dealing:false,
    wall,
    discards:[],
    lastDiscard:null,
    lastAction:null,
    pendingGang:null,
    drawnTileId:null,
    selectedTileIndex:null,
    players:[
      {name:names[0],hand:hand0,melds:[],won:false,missingSuit:"w"},
      {name:names[1],hand:hand1,melds:[],won:false,missingSuit:"w"},
      {name:names[2],hand:hand2,melds:[],won:false,missingSuit:"w"},
      {
        name:names[3],
        hand:hand3,
        melds:[],
        won:true,
        missingSuit:"t",
        winTile,
        winInfo:{name:"平胡",basePattern:"平胡"}
      }
    ],
    logs:[
      "【结束牌局场景】牌墙已空。",
      "自己：未下叫 · 上家：花猪 · 对家：已下叫（听5筒） · 下家：已胡。"
    ],
    activeRules:snapshotRules({
      ...rules,
      exchangeThree:false,
      gangRain:true
    }),
    scores:[...scores],
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  toast("结束牌局场景 · 正在结算");
  finalizeRound("结束牌局场景");
}

/**
 * localhost：四家已胡徽标验收（对家含 庄+缺万+已胡）。
 */
function loadAllHuBadgeScenario(){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  clearWinUi();
  document.getElementById("exchangeModal")?.classList.remove("show");
  document.getElementById("roundEndModal")?.classList.remove("show");
  document.getElementById("newGameModal")?.classList.remove("show");
  hideRoundReveal();

  const mkTile=(s,n,id)=>cloneTile({s,n,id});
  const mkHand=(tag)=>[
    mkTile("t",1,`${tag}-t1a`),
    mkTile("t",1,`${tag}-t1b`),
    mkTile("t",1,`${tag}-t1c`),
    mkTile("t",2,`${tag}-t2a`),
    mkTile("t",2,`${tag}-t2b`),
    mkTile("t",2,`${tag}-t2c`),
    mkTile("t",3,`${tag}-t3a`),
    mkTile("t",3,`${tag}-t3b`),
    mkTile("t",3,`${tag}-t3c`),
    mkTile("b",7,`${tag}-b7a`),
    mkTile("b",7,`${tag}-b7b`),
    mkTile("b",7,`${tag}-b7c`),
    mkTile("b",5,`${tag}-win`)
  ];
  const hands=[
    mkHand("badge-0"),
    mkHand("badge-1"),
    mkHand("badge-2"),
    mkHand("badge-3")
  ];
  hands.forEach(sortHand);

  state={
    version:"0.10",
    phase:"出牌",
    turn:0,
    dealer:2,
    dealing:false,
    wall:[],
    discards:[],
    lastDiscard:null,
    lastAction:null,
    pendingGang:null,
    drawnTileId:null,
    selectedTileIndex:null,
    players:[0,1,2,3].map((index)=>({
      name:names[index],
      hand:hands[index],
      melds:[],
      won:true,
      missingSuit:"w",
      winTile:hands[index][hands[index].length-1],
      winInfo:{name:index===2?"清一色":"平胡",basePattern:index===2?"清一色":"平胡"}
    })),
    logs:["【已胡徽标四家】对家坐庄，四家均已胡。"],
    activeRules:snapshotRules(rules),
    scores:loadSessionScores(),
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  commit();
  toast("已胡徽标四家：对家应显示 庄+缺万+已胡");
}

/**
 * localhost：终局超长内容验收
 * A: 4碰 + 胡牌 + 多 bits
 * B: 2暗杠2碰 + 胡牌 + 查叫收入
 * C: 未胡 + 花猪 + 长扣分
 * D: 四家都较长
 */
function loadRevealStressScenario(){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  clearWinUi();
  document.getElementById("exchangeModal")?.classList.remove("show");
  document.getElementById("roundEndModal")?.classList.remove("show");
  hideRoundReveal();

  const mk=(suit,num,count,tag)=>Array.from({length:count},(_,i)=>cloneTile({s:suit,n:num,id:`rv-${tag}-${suit}${num}-${i}`}));
  const cloneMeld=(type,suit,num,count,from,tag)=>({type,from,tiles:mk(suit,num,count,tag)});

  const players=[
    {
      name:names[0],
      hand:[...mk("b",2,3,"a-h"),...mk("t",6,3,"a-h2"),...mk("w",9,2,"a-h3")],
      melds:[
        cloneMeld("peng","w",1,3,1,"a-p1"),
        cloneMeld("peng","w",2,3,2,"a-p2"),
        cloneMeld("peng","t",3,3,3,"a-p3"),
        cloneMeld("peng","b",4,3,1,"a-p4")
      ],
      won:true,
      missingSuit:"w"
    },
    {
      name:names[1],
      hand:[...mk("t",1,3,"b-h"),...mk("b",7,3,"b-h2"),...mk("w",8,2,"b-h3")],
      melds:[
        cloneMeld("anGang","w",3,4,1,"b-g1"),
        cloneMeld("anGang","t",4,4,1,"b-g2"),
        cloneMeld("peng","b",5,3,0,"b-p1"),
        cloneMeld("peng","b",6,3,2,"b-p2")
      ],
      won:true,
      missingSuit:"t"
    },
    {
      name:names[2],
      hand:[...mk("t",2,3,"c-h"),...mk("b",3,3,"c-h2"),...mk("w",6,4,"c-h3")],
      melds:[cloneMeld("peng","t",8,3,0,"c-p1")],
      won:false,
      missingSuit:"w"
    },
    {
      name:names[3],
      hand:[...mk("w",4,3,"d-h"),...mk("t",5,3,"d-h2"),...mk("b",9,2,"d-h3")],
      melds:[
        cloneMeld("mingGang","w",7,4,0,"d-g1"),
        cloneMeld("buGang","b",2,4,1,"d-g2"),
        cloneMeld("peng","t",9,3,2,"d-p1")
      ],
      won:true,
      missingSuit:"b"
    }
  ];

  players[0].winTile=mk("w",9,1,"a-win")[0];
  players[1].winTile=mk("w",8,1,"b-win")[0];
  players[3].winTile=mk("b",9,1,"d-win")[0];
  players[0].hand.push(players[0].winTile);
  players[1].hand.push(players[1].winTile);
  players[3].hand.push(players[3].winTile);
  players.forEach(p=>sortHand(p.hand));

  state={
    version:"0.10",
    phase:"结束",
    turn:0,
    dealer:1,
    dealing:false,
    wall:[],
    discards:[],
    lastDiscard:null,
    lastAction:null,
    pendingGang:null,
    drawnTileId:null,
    selectedTileIndex:null,
    players,
    logs:["【终局超长内容】A/B/C/D 混合验收。"],
    activeRules:snapshotRules({...rules,exchangeThree:false,gangRain:true}),
    scores:loadSessionScores(),
    roundDelta:[131,48,-66,22],
    scoreLog:[],
    roundSettlement:{
      ...emptyRoundSettlement(),
      readyHandResults:[
        {playerIndex:1,isReady:true,waitingTiles:[cloneTile({s:"b",n:3,id:"wait-b1"}),cloneTile({s:"b",n:6,id:"wait-b2"})]},
        {playerIndex:2,isReady:false,waitingTiles:[]}
      ]
    },
    revealAllHands:true
  };

  commit();
  const summary=[
    {
      name:seatWho(0),
      won:true,
      delta:131,
      total:20266,
      missingSuitLabel:"万",
      bits:["清一色 6番 +64","对对胡 3番 +32","查叫收入 +35"]
    },
    {
      name:seatWho(1),
      won:true,
      delta:48,
      total:18320,
      missingSuitLabel:"条",
      bits:["双暗杠 +16","查叫收入 +20","平胡 2番 +12"]
    },
    {
      name:seatWho(2),
      flowerPig:true,
      delta:-66,
      total:15440,
      missingSuitLabel:"万",
      status:"花猪 + 未下叫，扣分较多",
      bits:["花猪 -32","未下叫 -18","被查叫 -16"]
    },
    {
      name:seatWho(3),
      won:true,
      delta:22,
      total:17654,
      missingSuitLabel:"筒",
      bits:["杠上花 2番 +8","补杠 +4","明杠 +2","查叫收入 +8"]
    }
  ];
  renderRoundReveal(state,state.roundSettlement,{
    onNewGame:()=>{},
    onClose:()=>{},
    reason:"终局超长内容",
    summary
  });
  toast("终局超长内容：检查牌面换行与总分保护区");
}

/** localhost：副露来源方向验收（重点：自己→下家 = 最下） */
function loadMeldSourceMarkScenario(){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  hideStartOverlay();
  clearWinUi();
  document.getElementById("exchangeModal")?.classList.remove("show");
  document.getElementById("roundEndModal")?.classList.remove("show");
  document.getElementById("newGameModal")?.classList.remove("show");
  hideRoundReveal();

  const wall=createWall();
  const mk=(suit,num,count,tag)=>pullTiles(wall,suit,num,count).map((t,i)=>({...t,id:`src-${tag}-${suit}${num}-${i}`}));

  // 下家：自己打出的碰 + 直杠（来源应在最下）
  const melds3=[
    {type:"peng",from:0,debugPreset:true,tiles:mk("b",8,3,"r-peng")},
    {type:"mingGang",from:0,debugPreset:true,tiles:mk("w",1,4,"r-gang")}
  ];
  // 上家：自己打出的碰（竖列最下）
  const melds1=[
    {type:"peng",from:0,debugPreset:true,tiles:mk("t",2,3,"l-peng")}
  ];
  // 对家：自己打出的碰（横排居中）
  const melds2=[
    {type:"peng",from:0,debugPreset:true,tiles:mk("t",5,3,"o-peng")}
  ];
  // 自己：上/对/下三向碰
  const melds0=[
    {type:"peng",from:1,debugPreset:true,tiles:mk("w",5,3,"s-from1")},
    {type:"peng",from:2,debugPreset:true,tiles:mk("w",6,3,"s-from2")},
    {type:"peng",from:3,debugPreset:true,tiles:mk("w",7,3,"s-from3")}
  ];

  const hand0=[pullTile(wall,"b",1),pullTile(wall,"b",2)];
  const hand1=[pullTile(wall,"b",3),pullTile(wall,"b",4)];
  const hand2=[pullTile(wall,"t",7),pullTile(wall,"t",8)];
  const hand3=[pullTile(wall,"t",1),pullTile(wall,"t",3)];
  [hand0,hand1,hand2,hand3].forEach(sortHand);

  state={
    version:"0.10",
    phase:"出牌",
    turn:0,
    dealer:0,
    dealing:false,
    wall,
    eventSeq:1,
    discards:[],
    lastDiscard:null,
    lastAction:null,
    pendingGang:null,
    drawnTileId:null,
    selectedTileIndex:null,
    players:[
      {name:names[0],hand:hand0,melds:melds0,won:false,missingSuit:"t"},
      {name:names[1],hand:hand1,melds:melds1,won:false,missingSuit:"w"},
      {name:names[2],hand:hand2,melds:melds2,won:false,missingSuit:"w"},
      {name:names[3],hand:hand3,melds:melds3,won:false,missingSuit:"b"}
    ],
    logs:["【来源标记】重点：自己→下家碰/直杠 · 来源应在最下"],
    activeRules:snapshotRules({...rules,exchangeThree:false,gangRain:true}),
    scores:loadSessionScores(),
    roundDelta:[0,0,0,0],
    scoreLog:[],
    roundSettlement:emptyRoundSettlement(),
    revealAllHands:false
  };

  setLayoutDebug(true);
  commit();
  applySeatLayoutToTable();
  const audit=auditMeldSourceMarks();
  console.log("[meld-source marks]",audit);
  toast("来源标记场景已加载");
  return audit;
}

function auditMeldSourceMarks(){
  const right=document.getElementById("meld-3");
  const groups=[...(right?.querySelectorAll(".meld-group")||[])];
  const checks=groups.map(g=>{
    const wraps=[...g.querySelectorAll(".meld-layer-base .meld-tile-wrap, .meld-layer-flat .meld-tile-wrap")];
    const srcIdx=wraps.findIndex(w=>w.classList.contains("is-source"));
    return{
      className:g.className,
      baseCount:wraps.length,
      sourceIndex:srcIdx,
      isBottom:wraps.length>0&&srcIdx===wraps.length-1,
      hasBottomClass:g.classList.contains("meld-source-bottom")
    };
  });
  return{
    checks,
    ok:checks.length>=2&&checks.every(c=>c.isBottom&&c.hasBottomClass)
  };
}

function demoDiscardEventsFourSeats(){
  const sampleTiles=[
    {s:"w",n:1,id:"demo-d0"},
    {s:"t",n:9,id:"demo-d1"},
    {s:"b",n:5,id:"demo-d2"},
    {s:"w",n:8,id:"demo-d3"}
  ];
  const order=[0,1,2,3];
  const players=state?.players||[{},{},{},{}];
  toast("出牌提示：自己 → 上家 → 对家 → 下家");
  order.forEach((playerIndex,i)=>{
    setTimeout(()=>{
      showDiscardEvent({
        playerIndex,
        tile:sampleTiles[playerIndex],
        players,
        eventId:9000+playerIndex,
        duration:1500,
        showSelfDiscard:true
      });
    },i*1000);
  });
}

function setupRuleTestButton(){
  if(!isLocalDevHost())return;
  const actions=document.querySelector(".topbar-actions")||document.querySelector(".topbar");
  if(!actions||document.getElementById("ruleTestBtn"))return;

  const suiteBtn=document.createElement("button");
  suiteBtn.type="button";
  suiteBtn.id="ruleTestBtn";
  suiteBtn.className="btn btn-dev";
  suiteBtn.textContent="规则测试";
  suiteBtn.title="跑固定断言套件";
  actions.appendChild(suiteBtn);
  suiteBtn.addEventListener("click",()=>{
    const result=runRuleTests();
    console.log("[mahjong rule-tests]\n"+result.lines.join("\n"));
    toast(result.ok
      ?`规则测试通过 ${result.passed}/${result.passed+result.failed}`
      :`规则测试失败 ${result.failed} 项，见控制台`);
  });

  const sceneBtn=document.createElement("button");
  sceneBtn.type="button";
  sceneBtn.id="ruleSceneBtn";
  sceneBtn.className="btn btn-dev";
  sceneBtn.textContent="碰杠场景";
  sceneBtn.title="四家各2暗杠+2碰 · 副露极限布局（不结算）";
  actions.appendChild(sceneBtn);
  sceneBtn.addEventListener("click",()=>{
    try{
      loadRuleTestScenario();
    }catch(error){
      console.error("[peng-gang scene]",error);
      toast("碰杠场景加载失败");
    }
  });

  const sourceBtn=document.createElement("button");
  sourceBtn.type="button";
  sourceBtn.id="meldSourceSceneBtn";
  sourceBtn.className="btn btn-dev";
  sourceBtn.textContent="来源标记";
  sourceBtn.title="验收副露来源方向：重点自己→下家碰/直杠";
  actions.appendChild(sourceBtn);
  sourceBtn.addEventListener("click",()=>{
    try{
      loadMeldSourceMarkScenario();
    }catch(error){
      console.error("[meld-source scene]",error);
      toast("来源标记场景加载失败");
    }
  });

  const endBtn=document.createElement("button");
  endBtn.type="button";
  endBtn.id="endRoundSceneBtn";
  endBtn.className="btn btn-dev";
  endBtn.textContent="结束牌局场景";
  endBtn.title="固定：未下叫 / 花猪 / 已下叫 / 已胡 → 终局结算与亮牌";
  actions.appendChild(endBtn);
  endBtn.addEventListener("click",loadEndRoundScenario);

  const huBadgeBtn=document.createElement("button");
  huBadgeBtn.type="button";
  huBadgeBtn.id="allHuBadgeBtn";
  huBadgeBtn.className="btn btn-dev";
  huBadgeBtn.textContent="已胡徽标四家";
  huBadgeBtn.title="四家 won=true；对家坐庄+缺万+已胡，验收顶部徽标";
  actions.appendChild(huBadgeBtn);
  huBadgeBtn.addEventListener("click",()=>{
    try{
      loadAllHuBadgeScenario();
    }catch(error){
      console.error("[all-hu-badge]",error);
      toast("已胡徽标四家加载失败");
    }
  });

  const revealStressBtn=document.createElement("button");
  revealStressBtn.type="button";
  revealStressBtn.id="revealStressBtn";
  revealStressBtn.className="btn btn-dev";
  revealStressBtn.textContent="终局超长内容";
  revealStressBtn.title="终局弹窗 A/B/C/D：长副露、长手牌、花猪、查叫、胡牌";
  actions.appendChild(revealStressBtn);
  revealStressBtn.addEventListener("click",()=>{
    try{
      loadRevealStressScenario();
    }catch(error){
      console.error("[reveal-stress]",error);
      toast("终局超长内容加载失败");
    }
  });

  const stressBtn=document.createElement("button");
  stressBtn.type="button";
  stressBtn.id="layoutStressBtn";
  stressBtn.className="btn btn-dev";
  stressBtn.textContent="布局压力";
  stressBtn.title="各 4 组副露 + 18 张弃牌";
  actions.appendChild(stressBtn);
  stressBtn.addEventListener("click",()=>{
    try{
      loadLayoutStressScenario();
    }catch(error){
      console.error("[layout-stress]",error);
      toast("布局压力加载失败");
    }
  });

  const discardCueBtn=document.createElement("button");
  discardCueBtn.type="button";
  discardCueBtn.id="discardCueDemoBtn";
  discardCueBtn.className="btn btn-dev";
  discardCueBtn.textContent="出牌提示四家";
  discardCueBtn.title="依次演示自己/上家/对家/下家出牌浮窗锚点";
  actions.appendChild(discardCueBtn);
  discardCueBtn.addEventListener("click",()=>{
    demoDiscardEventsFourSeats();
  });
}

document.getElementById("newGameBtn").addEventListener("click",()=>{
  initAudio();
  openNewGameConfirm();
});

function openNamesModal(){
  names=loadNames();
  for(let i=0;i<4;i++){
    const input=document.getElementById(`nameInput${i}`);
    if(input)input.value=names[i]||"";
  }
  document.getElementById("namesModal").classList.add("show");
}

document.getElementById("editNamesBtn")?.addEventListener("click",openNamesModal);

document.getElementById("namesCancel")?.addEventListener("click",()=>{
  document.getElementById("namesModal").classList.remove("show");
});

document.getElementById("namesSave")?.addEventListener("click",()=>{
  const next=[0,1,2,3].map(i=>document.getElementById(`nameInput${i}`)?.value||"");
  names=saveNames(next);
  state.players.forEach((player,index)=>{
    player.name=names[index];
  });
  document.getElementById("namesModal").classList.remove("show");
  commit();
  toast("名字已保存");
});

function openNewGameConfirm(){
  const detail=document.getElementById("newGameDetail");
  if(detail){
    detail.textContent=
      state.phase==="准备"||state.phase==="结束"
        ?"将轮流坐庄，并掷骰后发牌。"
        :"当前牌局将结束，下一局轮流坐庄并重新掷骰发牌。";
  }
  document.getElementById("newGameModal").classList.add("show");
}

document.getElementById("newGameCancel").addEventListener("click",()=>{
  document.getElementById("newGameModal").classList.remove("show");
});

document.getElementById("newGameConfirm").addEventListener("click",()=>{
  document.getElementById("newGameModal").classList.remove("show");
  clearState();
  newGame();
});

document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    saveState(state);
    stopSpeech();
  }
});
window.addEventListener("pagehide",()=>{
  saveState(state);
  stopSpeech();
});

setupRuleTestButton();

if(isLocalDevHost()){
  window.loadLayoutStressScenario=loadLayoutStressScenario;
  window.loadAnGangDisplayScenario=loadAnGangDisplayScenario;
  window.loadRuleTestScenario=loadRuleTestScenario;
  window.loadMeldSourceMarkScenario=loadMeldSourceMarkScenario;
  window.loadAllHuBadgeScenario=loadAllHuBadgeScenario;
  window.loadRevealStressScenario=loadRevealStressScenario;
  window.auditSeatLayout=auditSeatLayout;
  window.auditAnGangDisplay=auditAnGangDisplay;
  window.auditPengGangScene=auditPengGangScene;
  window.auditMeldSourceMarks=auditMeldSourceMarks;
  window.clearPlayerEvent=clearPlayerEvent;
  window.demoDiscardEventsFourSeats=demoDiscardEventsFourSeats;
  window.showDiscardEvent=showDiscardEvent;
}

window.addEventListener("resize",()=>{
  applySeatLayoutToTable();
});

document.getElementById("lobbyStartBtn")?.addEventListener("click",()=>{
  initAudio();
  ensureSessionClock();
  clearState();
  newGame();
});

ensureSessionClock();
setInterval(()=>checkEyeWarn(toast),30000);
checkEyeWarn(toast);

function enterLobby(){
  openingSeq++;
  cancelAiSchedule();
  hideReaction();
  document.getElementById("exchangeModal")?.classList.remove("show");
  clearWinUi();
  document.getElementById("roundEndModal")?.classList.remove("show");
  document.getElementById("newGameModal")?.classList.remove("show");
  state=createInitialState();
  commit();
  showLobby();
}

if(state.phase==="开局"||state.players.every(p=>p.hand.length===0)||state.phase==="准备"){
  enterLobby();
}else{
  hideStartOverlay();
  commit();
  if(state.phase==="定缺"){
    showMissingSuitModal(state.players[0].hand,suit=>confirmMissingSuits(suit));
  }else if(state.phase==="换三张"){
    openExchange();
  }else if(state.phase==="摸牌")scheduleAutoDraw();
  else if(state.phase==="出牌"&&state.turn!==0)scheduleAiDiscard();
}
