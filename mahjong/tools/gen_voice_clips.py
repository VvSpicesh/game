#!/usr/bin/env python3
"""Generate local mahjong voice clips via edge-tts (run once when refreshing assets)."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("pip install edge-tts", file=sys.stderr)
    raise

VOICE = "zh-CN-XiaoxiaoNeural"
OUT = Path(__file__).resolve().parent.parent / "sounds" / "voice"

# key -> spoken text
CLIPS: dict[str, str] = {}

NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
SUITS = {"w": "万", "t": "条", "b": "筒"}
for s, cn in SUITS.items():
    for n in range(1, 10):
        CLIPS[f"tile_{s}{n}"] = f"{NUM[n]}{cn}"

CLIPS.update(
    {
        "act_peng": "碰",
        "act_gang": "杠",
        "act_hu": "胡",
        "act_zimo": "自摸",
        "act_qiangganghu": "抢杠胡",
        "act_round_end": "牌局结束",
        "act_gskh": "杠上开花",
        "seat_0": "自己",
        "seat_1": "上家",
        "seat_2": "对家",
        "seat_3": "下家",
        "shot_pao": "放炮",
        "shot_gsp": "杠上炮",
        "shot_ypdx": "一炮多响",
        "word_qiang": "抢",
        "pat_pinghu": "平胡",
        "pat_qld": "清龙七对",
        "pat_qqd": "清七对",
        "pat_lqd": "龙七对",
        "pat_aqd": "暗七对",
        "pat_qd": "七对",
        "pat_qdd": "清大对",
        "pat_qys": "清一色",
        "pat_ddz": "大对子",
        "pat_ddh": "对对胡",
        "pat_jgd": "金钩钓",
        "pat_jd": "将对",
        "pat_qdy": "清带幺",
        "pat_dy": "带幺",
        "pat_qysdd": "清一色对对",
    }
)


async def one(key: str, text: str) -> None:
    path = OUT / f"{key}.mp3"
    communicate = edge_tts.Communicate(text, VOICE, rate="+10%")
    await communicate.save(str(path))
    print(f"ok {key} ({path.stat().st_size} bytes)")


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # sequential: edge rate-limits parallel requests
    for key, text in CLIPS.items():
        path = OUT / f"{key}.mp3"
        if path.exists() and path.stat().st_size > 200:
            print(f"skip {key}")
            continue
        await one(key, text)
        await asyncio.sleep(0.2)
    print(f"done {len(CLIPS)} clips -> {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
