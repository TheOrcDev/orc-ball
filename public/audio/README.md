# Orc Ball original chiptune set

These 17 tracks were composed and synthesized specifically for Orc Ball. The
WAV files are the loop masters; the MP3 files are convenient previews.

| Role | Title | Tempo | Length | Loop |
| --- | --- | ---: | ---: | --- |
| Menu | Moonlit Cartridge | 96 BPM | 20.000 s | Yes |
| Menu | Emberglass Title | 92 BPM | 20.870 s | Yes |
| Menu | Lanterns at Spawn | 88 BPM | 21.818 s | Yes |
| Menu | Save-Slot Starlight | 92 BPM | 20.870 s | Yes |
| Gameplay | Coin-Op Chase | 128 BPM | 15.000 s | Yes |
| Gameplay | Goblin Gearshift | 126 BPM | 15.238 s | Yes |
| Gameplay | Molten Token Run | 132 BPM | 14.545 s | Yes |
| Gameplay | Crypt Circuit | 138 BPM | 13.913 s | Yes |
| Gameplay | Rune Rail Rush | 122 BPM | 15.738 s | Yes |
| Gameplay | Goblin Voltage | 130 BPM | 14.769 s | Yes |
| Gameplay | Rune Runner Relay | 126 BPM | 15.238 s | Yes |
| Gameplay | Shadow Coil Sprint | 132 BPM | 14.545 s | Yes |
| Gameplay | Neon Bog Sprint | 130 BPM | 14.769 s | Yes |
| Gameplay | Clockwork Caverns | 126 BPM | 15.238 s | Yes |
| Gameplay | Crystal Circuit | 132 BPM | 14.545 s | Yes |
| Danger / low lives | One Heart Left | 144 BPM | 13.333 s | Yes |
| Level clear | Gem Secured | 128 BPM | 3.750 s | No |

At runtime, the 11 gameplay loops rotate by level index and the four menu
themes rotate on each visit to the title screen. Danger and level-clear remain
separate event cues.

For gapless browser playback, use the 44.1 kHz, 16-bit WAV masters. MP3
encoders add delay and padding, so MP3 is not guaranteed to loop without a
small gap in every browser.

The exact frame counts, keys, loudness, and loop validation results are in
`orc-ball-music-manifest.json`. Regenerate the masters with:

```sh
python3 scripts/generate_chiptunes.py
```
