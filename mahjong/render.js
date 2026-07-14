import { tileFace, tileName } from "./tiles.js";

export function createTileElement(tile, className=""){
  const el = document.createElement("div");
  el.className = `tile ${className}`;

  if(tile){
    el.innerHTML = tileFace(tile);
    el.title = tileName(tile);
  }else{
    el.classList.add("tile-back");
  }

  return el;
}

export function renderGame(state, handlers){
  document.getElementById("remaining").textContent = state.wall.length;
  document.getElementById("phase").textContent = state.phase;
  document.getElementById("turn").textContent = `轮到：${state.players[state.turn].name}`;
  document.getElementById("statPhase").textContent = state.phase;
  document.getElementById("statTurn").textContent = state.players[state.turn].name;
  document.getElementById("statMissing").textContent = "未选择";
  document.getElementById("statStatus").textContent = state.players[0].won ? "已胡" : "未胡";

  state.players.forEach((player,index) => renderSeat(state,player,index,handlers));
  renderDiscards(state);
  renderActions(state,handlers);
}

function renderSeat(state,player,index,handlers){
  const seat = document.getElementById(`seat-${index}`);
  seat.innerHTML = "";

  const header = document.createElement("div");
  header.className = "seat-header";
  header.innerHTML = `
    <div>
      <div class="seat-name">${index===0 ? "🙂" : "🤖"} ${player.name}</div>
      <div class="seat-meta">${player.hand.length}张</div>
    </div>
    <div class="seat-meta">${player.won ? "已胡" : "进行中"}</div>
  `;
  seat.appendChild(header);

  const hand = document.createElement("div");
  hand.className = "hand";

  if(index === 1) hand.classList.add("hand-vertical","hand-left");
  if(index === 3) hand.classList.add("hand-vertical","hand-right");

  player.hand.forEach((tile,tileIndex) => {
    const el = index === 0
      ? createTileElement(tile)
      : createTileElement(null,"tile-small");

    if(index === 0 && state.turn === 0 && state.phase === "出牌"){
      el.addEventListener("click",() => handlers.onDiscard(tileIndex));
    }

    hand.appendChild(el);
  });

  seat.appendChild(hand);
}

function renderDiscards(state){
  for(let index=0; index<4; index++){
    const zone = document.getElementById(`discard-${index}`);
    zone.innerHTML = "";

    state.discards
      .filter(item => item.player === index)
      .forEach(item => zone.appendChild(createTileElement(item.tile,"tile-small")));
  }
}

function renderActions(state,handlers){
  const actions = document.getElementById("actions");
  actions.innerHTML = "";

  const draw = document.createElement("button");
  draw.className = "btn btn-primary";
  draw.textContent = "摸牌";
  draw.disabled = !(state.phase === "摸牌" && state.turn === 0);
  draw.addEventListener("click",handlers.onDraw);
  actions.appendChild(draw);
}

export function renderLog(messages){
  const el = document.getElementById("log");
  el.innerHTML = "";
  [...messages].reverse().forEach(message => {
    const p = document.createElement("p");
    p.textContent = message;
    el.appendChild(p);
  });
}
