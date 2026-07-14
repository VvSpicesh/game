const NUM_CN=["","一","二","三","四","五","六","七","八","九"];

function svg(content){
  return `<svg viewBox="0 0 100 140" aria-hidden="true">${content}</svg>`;
}
function circle(x,y,r,color){
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#173b2a" stroke-width="2"/>`;
}
function bamboo(x,y,rotate=0,color="#2b9a60"){
  return `<g transform="translate(${x} ${y}) rotate(${rotate})">
    <rect x="-6" y="-20" width="12" height="40" rx="6" fill="${color}" stroke="#174f34" stroke-width="2"/>
    <line x1="-3" y1="-12" x2="3" y2="-12" stroke="#d8f1df" stroke-width="2"/>
    <line x1="-3" y1="0" x2="3" y2="0" stroke="#d8f1df" stroke-width="2"/>
    <line x1="-3" y1="12" x2="3" y2="12" stroke="#d8f1df" stroke-width="2"/>
  </g>`;
}

export function tileName(tile){
  return `${tile.n}${{w:"万",t:"条",b:"筒"}[tile.s]}`;
}

export function tileFace(tile){
  if(tile.s==="w"){
    return svg(`
      <text x="50" y="62" text-anchor="middle" font-size="36" font-weight="700"
        font-family="Noto Serif SC,Songti SC,SimSun,serif" fill="#d6403b">${NUM_CN[tile.n]}</text>
      <text x="50" y="103" text-anchor="middle" font-size="22" font-weight="700"
        font-family="Noto Serif SC,Songti SC,SimSun,serif" fill="#d6403b">萬</text>
    `);
  }

  if(tile.s==="b"){
    const R="#d94b45",G="#2b9a60",B="#2e75ad";
    const layouts={
      1:[[50,70,27,R]],
      2:[[50,38,14,G],[50,102,14,B]],
      3:[[30,32,11,B],[50,70,11,R],[70,108,11,G]],
      4:[[30,38,11,B],[70,38,11,G],[30,102,11,G],[70,102,11,B]],
      5:[[30,34,10,B],[70,34,10,G],[50,70,11,R],[30,106,10,G],[70,106,10,B]],
      6:[[28,32,10,G],[50,32,10,G],[72,32,10,G],[28,102,10,R],[50,102,10,R],[72,102,10,R]],
      7:[[28,27,9,G],[50,27,9,G],[72,27,9,G],[28,65,9,R],[72,65,9,R],[28,105,9,R],[72,105,9,R]],
      8:[[28,24,9,B],[50,24,9,B],[72,24,9,B],[28,58,9,B],[72,58,9,G],[28,94,9,G],[50,94,9,G],[72,94,9,G]],
      9:[[28,25,9,B],[50,25,9,B],[72,25,9,B],[28,67,9,R],[50,67,9,R],[72,67,9,R],[28,109,9,G],[50,109,9,G],[72,109,9,G]]
    };
    return svg(layouts[tile.n].map(([x,y,r,c])=>circle(x,y,r,c)).join(""));
  }

  if(tile.n===1){
    /* 幺鸡：竹竿 + 侧视小鸡，避免大圆被看成一筒 */
    return svg(`
      <rect x="47" y="22" width="6" height="98" rx="3" fill="#2f9f61" stroke="#175338" stroke-width="2"/>
      <line x1="48.5" y1="42" x2="51.5" y2="42" stroke="#e7f7ea" stroke-width="2"/>
      <line x1="48.5" y1="68" x2="51.5" y2="68" stroke="#e7f7ea" stroke-width="2"/>
      <line x1="48.5" y1="94" x2="51.5" y2="94" stroke="#e7f7ea" stroke-width="2"/>
      <ellipse cx="42" cy="58" rx="14" ry="11" fill="#3cbc74" stroke="#175338" stroke-width="2"/>
      <circle cx="32" cy="50" r="7" fill="#3cbc74" stroke="#175338" stroke-width="2"/>
      <path d="M24 50 L16 48 L24 46 Z" fill="#e8a23a" stroke="#b56b12" stroke-width="1"/>
      <path d="M30 44 L28 38 L34 42 Z" fill="#d94b45"/>
      <circle cx="30" cy="49" r="1.6" fill="#173b2a"/>
      <path d="M48 64 Q58 58 62 50" fill="none" stroke="#2f9f61" stroke-width="3"/>
      <path d="M38 68 L36 78 M46 68 L48 78" stroke="#e8a23a" stroke-width="2"/>
    `);
  }

  const G="#2b9a60",R="#d94b45";
  const layouts={
    2:[[50,38,0,G],[50,102,0,G]],
    3:[[32,34,-10,G],[68,34,10,G],[50,100,0,R]],
    4:[[30,38,-8,G],[70,38,8,G],[30,102,8,G],[70,102,-8,G]],
    5:[[30,32,-8,G],[70,32,8,G],[50,70,0,R],[30,108,8,G],[70,108,-8,G]],
    6:[[28,30,-8,G],[50,30,0,G],[72,30,8,G],[28,102,8,G],[50,102,0,G],[72,102,-8,G]],
    7:[[28,26,-8,G],[50,26,0,G],[72,26,8,G],[28,64,8,G],[72,64,-8,G],[36,106,4,R],[64,106,-4,R]],
    8:[[28,24,-8,G],[50,24,0,G],[72,24,8,G],[28,58,8,G],[72,58,-8,G],[28,102,-8,G],[50,102,0,G],[72,102,8,G]],
    9:[[28,23,-8,G],[50,23,0,G],[72,23,8,G],[28,67,8,G],[50,67,0,R],[72,67,-8,G],[28,111,-8,G],[50,111,0,G],[72,111,8,G]]
  };
  return svg(layouts[tile.n].map(([x,y,r,c])=>bamboo(x,y,r,c)).join(""));
}
