import {renderGame,renderLog,renderExchange} from "./render.js";
import {saveState,loadState,clearState} from "./storage.js";
import {loadRules,saveRules} from "./config.js";
import {tileName} from "./tiles.js";

const names=["你","阿麻","小川","幺鸡"];
let rules=loadRules();
let state=loadState()||createInitialState();
let aiTimer=null;
let exchangeSelection=[];

const ruleExchange=document.getElementById("ruleExchange");
const ruleGang=document.getElementById("ruleGang");

ruleExchange.checked=rules.exchangeThree;
ruleGang.checked=rules.gangRain;

ruleExchange.addEventListener("change",()=>{
  rules.exchangeThree=ruleExchange.checked;
  saveRules(rules);
});

ruleGang.addEventListener("change",()=>{
  rules.gangRain=ruleGang.checked;
  saveRules(rules);
});

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

function createInitialState(){
  return {
    version:"0.3",
    phase:"准备",
    wall:[],
    players:names.map(name=>({name,hand:[],won:false,melds:[]})),
    turn:0,
    discards:[],
    logs:["欢迎来到 Nocturne Mahjong。"],
    drawnTileId:null,
    selectedTileIndex:null,
    activeRules:{...rules}
  };
}

function sortHand(hand){
  const order={w:0,t:1,b:2};
  hand.sort((a,b)=>order[a.s]-order[b.s]||a.n-b.n);
}

function newGame(){
  clearTimeout(aiTimer);
  rules=loadRules();

  const wall=createWall();
  const players=names.map(name=>({name,hand:[],won:false,melds:[]}));

  for(let round=0;round<13;round++){
    for(let player=0;player<4;player++){
      players[player].hand.push(wall.pop());
    }
  }

  players.forEach(player=>sortHand(player.hand));

  state={
    version:"0.3",
    phase:rules.exchangeThree?"换三张":"摸牌",
    wall,
    players,
    turn:0,
    discards:[],
    logs:[
      `新牌局开始。换三张：${rules.exchangeThree?"开启":"关闭"}；刮风下雨：${rules.gangRain?"开启":"关闭"}。`
    ],
    drawnTileId:null,
    selectedTileIndex:null,
    activeRules:{...rules}
  };

  commit();

  if(rules.exchangeThree){
    openExchange();
  }else{
    scheduleAutoDraw();
  }
}

function openExchange(){
  exchangeSelection=[];
  renderExchange(state.players[0].hand,exchangeSelection,toggleExchangeTile);
  document.getElementById("exchangeModal").classList.add("show");
}

function toggleExchangeTile(index){
  const position=exchangeSelection.indexOf(index);

  if(position>=0){
    exchangeSelection.splice(position,1);
  }else{
    if(exchangeSelection.length>=3){
      toast("只能选择三张牌");
      return;
    }
    exchangeSelection.push(index);
  }

  renderExchange(state.players[0].hand,exchangeSelection,toggleExchangeTile);
}

document.getElementById("exchangeConfirm").addEventListener("click",()=>{
  if(exchangeSelection.length!==3)return;

  const outgoing=exchangeSelection
    .sort((a,b)=>b-a)
    .map(index=>state.players[0].hand.splice(index,1)[0]);

  const allOutgoing=[outgoing];

  for(let playerIndex=1;playerIndex<4;playerIndex++){
    const hand=state.players[playerIndex].hand;
    const chosen=chooseExchangeTiles(hand);
    const cards=chosen
      .sort((a,b)=>b-a)
      .map(index=>hand.splice(index,1)[0]);
    allOutgoing[playerIndex]=cards;
  }

  for(let playerIndex=0;playerIndex<4;playerIndex++){
    const from=(playerIndex+3)%4;
    state.players[playerIndex].hand.push(...allOutgoing[from]);
    sortHand(state.players[playerIndex].hand);
  }

  state.logs.push("换三张完成。本局允许混合花色换牌。");
  state.phase="摸牌";
  document.getElementById("exchangeModal").classList.remove("show");
  commit();
  scheduleAutoDraw();
});

function chooseExchangeTiles(hand){
  const scored=hand.map((tile,index)=>({
    index,
    score:keepScore(tile,hand)
  }));

  scored.sort((a,b)=>a.score-b.score);
  return scored.slice(0,3).map(item=>item.index);
}

function scheduleAutoDraw(){
  clearTimeout(aiTimer);

  if(state.phase!=="摸牌")return;

  aiTimer=setTimeout(autoDraw,state.turn===0?260:420);
}

function autoDraw(){
  if(state.phase!=="摸牌"||!state.wall.length)return;

  const player=state.players[state.turn];
  const tile=state.wall.pop();

  player.hand.push(tile);
  sortHand(player.hand);

  state.drawnTileId=tile.id;
  state.selectedTileIndex=null;
  state.logs.push(`${player.name}摸牌。`);
  state.phase="出牌";
  commit();

  if(state.turn!==0){
    aiTimer=setTimeout(aiDiscard,500);
  }
}

function handleTileClick(tileIndex){
  if(state.turn!==0||state.phase!=="出牌")return;

  if(state.selectedTileIndex===tileIndex){
    discard(tileIndex);
    return;
  }

  state.selectedTileIndex=tileIndex;
  commit();
}

function discard(tileIndex){
  const player=state.players[0];
  const [tile]=player.hand.splice(tileIndex,1);

  state.discards.push({player:0,tile});
  state.logs.push(`你打出 ${tileName(tile)}。`);
  state.drawnTileId=null;
  state.selectedTileIndex=null;

  nextTurn();
}

function aiDiscard(){
  if(state.turn===0||state.phase!=="出牌")return;

  const player=state.players[state.turn];
  const tileIndex=chooseDiscard(player.hand);
  const [tile]=player.hand.splice(tileIndex,1);

  state.discards.push({player:state.turn,tile});
  state.logs.push(`${player.name}打出 ${tileName(tile)}。`);
  state.drawnTileId=null;
  state.selectedTileIndex=null;

  nextTurn();
}

function chooseDiscard(hand){
  const scores=hand.map((tile,index)=>({
    index,
    score:keepScore(tile,hand)
  }));

  scores.sort((a,b)=>a.score-b.score);
  return scores[0].index;
}

function keepScore(tile,hand){
  const same=hand.filter(t=>t.s===tile.s&&t.n===tile.n).length;
  const near1=hand.filter(t=>t.s===tile.s&&Math.abs(t.n-tile.n)===1).length;
  const near2=hand.filter(t=>t.s===tile.s&&Math.abs(t.n-tile.n)===2).length;
  return same*5+near1*3+near2;
}

function nextTurn(){
  state.turn=(state.turn+1)%4;
  state.phase="摸牌";
  commit();
  scheduleAutoDraw();
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
  el._timer=setTimeout(()=>el.classList.remove("show"),1600);
}

document.getElementById("newGameBtn").addEventListener("click",()=>{
  if(state.phase==="准备"||confirm("确定开始新牌局吗？")){
    clearState();
    newGame();
  }
});

document.addEventListener("visibilitychange",()=>{
  if(document.hidden)saveState(state);
});
window.addEventListener("pagehide",()=>saveState(state));

commit();

if(state.phase==="摸牌"){
  scheduleAutoDraw();
}else if(state.phase==="出牌"&&state.turn!==0){
  aiTimer=setTimeout(aiDiscard,500);
}
