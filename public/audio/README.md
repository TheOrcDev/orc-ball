# Orc Ball original chiptune set

These tracks were composed and synthesized specifically for Orc Ball. The WAV
files are the loop masters; the MP3 files are convenient previews.

| Role | Title | Tempo | Length | Loop |
| --- | --- | ---: | ---: | --- |
| Menu | Moonlit Cartridge | 96 BPM | 20.000 s | Yes |
| Gameplay | Coin-Op Chase | 128 BPM | 15.000 s | Yes |
| Danger / low lives | One Heart Left | 144 BPM | 13.333 s | Yes |
| Level clear | Gem Secured | 128 BPM | 3.750 s | No |

For gapless browser playback, use the 44.1 kHz, 16-bit WAV masters. MP3
encoders add delay and padding, so MP3 is not guaranteed to loop without a
small gap in every browser.

The exact frame counts, keys, loudness, and loop validation results are in
`orc-ball-music-manifest.json`. Regenerate the masters with:

```sh
python3 scripts/generate_chiptunes.py
```
