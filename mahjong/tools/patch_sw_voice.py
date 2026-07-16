from pathlib import Path

root = Path(__file__).resolve().parents[2]
sw_path = root / "service-worker.js"
sw = sw_path.read_text(encoding="utf-8")
voices = sorted((root / "mahjong" / "sounds" / "voice").glob("*.mp3"))
block = "\n".join(f'  "./mahjong/sounds/voice/{p.name}",' for p in voices)
sw = sw.replace("nocturne-games-v37", "nocturne-games-v38")
sw = sw.replace("0.14.32-speech3", "0.14.33")
needle = '  "./mahjong/audio.js?v=0.14.33"\n];'
if needle not in sw:
    raise SystemExit("needle missing")
sw = sw.replace(needle, '  "./mahjong/audio.js?v=0.14.33",\n' + block + "\n];")
old = r"return /\.(?:css|js|mjs|svg|png|webmanifest|ico|woff2?)$/i.test(url.pathname)"
new = r"return /\.(?:css|js|mjs|svg|png|mp3|webmanifest|ico|woff2?)$/i.test(url.pathname)"
if old not in sw:
    raise SystemExit("isStaticAsset pattern missing")
sw = sw.replace(old, new)
sw_path.write_text(sw, encoding="utf-8")
print(f"sw ok {len(voices)} voices")
