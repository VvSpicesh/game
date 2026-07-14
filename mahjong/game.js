import { renderGame, renderLog } from "./render.js";
import { saveState, loadState, clearState } from "./storage.js";
import { tileName } from "./tiles.js";

const names = ["你","阿麻","小川","幺鸡"];
let state = loadState() || createInitialState();
let aiTimer = null;

function createWall(){
  const wall = [];
  for(const suit of ["w","t","b"]){
    for(let number=1; number<=9; number++){
      for(let copy=0; copy<4; copy++){
        wall.push({s:suit,n:number,id:`${suit}${number}-${copy}`});
      }
    }
  }

  for(let i=wall.length-1; i>0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [wall[i],wall[j]] = [wall[j],wall[i]];
  }

  return wall;
}

function createInitialState(){
  return {
    version:"0.2",
    phase:"准备",
    wall:[],
    players:names.map(name => ({name,hand:[],won:false,melds:[]})),
    turn:0,
    discards:[],
    logs:["欢迎来到 Nocturne Mahjong。"]
  };
}

function sortHand(hand){
  const order = {w:0,t:1,b:2};
  hand.sort((a,b) => order[a.s]-order[b.s] || a.n-b.n);
}

function newGame(){
  clearTimeout(aiTimer);
  const wall = createWall();
  const players = names.map(name => ({name,hand:[],won:false,melds:[]}));

  for(let round=0; round<13; round++){
    for(let player=0; player<4; player++){
      players[player].hand.push(wall.pop());
    }
  }

  players.forEach(player => sortHand(player.hand));

  state = {
    version:"0.2",
    phase:"摸牌",
    wall,
    players,
    turn:0,
    discards:[],
    logs:["新牌局开始。你是庄家，请先摸牌。"]
  };

  commit();
}

function draw(){
  if(state.phase !== "摸牌" || !state.wall.length) return;

  const player = state.players[state.turn];
  player.hand.push(state.wall.pop());
  sortHand(player.hand);
  state.logs.push(`${player.name}摸了一张牌。`);
  state.phase = "出牌";
  commit();

  if(state.turn !== 0){
    aiTimer = setTimeout(aiDiscard,450);
  }
}

function discard(tileIndex){
  if(state.turn !== 0 || state.phase !== "出牌") return;

  const player = state.players[0];
  const [tile] = player.hand.splice(tileIndex,1);

  state.discards.push({player:0,tile});
  state.logs.push(`你打出 ${tileName(tile)}。`);
  nextTurn();
}

function aiDiscard(){
  const player = state.players[state.turn];
  const tileIndex = chooseDiscard(player.hand);
  const [tile] = player.hand.splice(tileIndex,1);

  state.discards.push({player:state.turn,tile});
  state.logs.push(`${player.name}打出 ${tileName(tile)}。`);
  nextTurn();
}

function chooseDiscard(hand){
  const scores = hand.map((tile,index) => {
    const same = hand.filter(t => t.s===tile.s && t.n===tile.n).length;
    const near1 = hand.filter(t => t.s===tile.s && Math.abs(t.n-tile.n)===1).length;
    const near2 = hand.filter(t => t.s===tile.s && Math.abs(t.n-tile.n)===2).length;
    return {index,score:same*5+near1*3+near2};
  });

  scores.sort((a,b) => a.score-b.score);
  return scores[0].index;
}

function nextTurn(){
  state.turn = (state.turn + 1) % 4;
  state.phase = "摸牌";
  commit();

  if(state.turn !== 0){
    aiTimer = setTimeout(draw,450);
  }
}

function commit(){
  saveState(state);
  renderGame(state,{onDraw:draw,onDiscard:discard});
  renderLog(state.logs);
}

document.getElementById("newGameBtn").addEventListener("click",() => {
  if(state.phase === "准备" || confirm("确定开始新牌局吗？")){
    newGame();
  }
});

document.addEventListener("visibilitychange",() => {
  if(document.hidden) saveState(state);
});
window.addEventListener("pagehide",() => saveState(state));

commit();

if(state.phase === "摸牌" && state.turn !== 0){
  aiTimer = setTimeout(draw,450);
}
