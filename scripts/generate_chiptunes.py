#!/usr/bin/env python3
"""Generate Orc Ball's original chiptune music as loop-ready PCM WAV files.

The synthesizer intentionally uses only Python's standard library so the
masters can be regenerated without installing audio packages.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import struct
import wave
from array import array
from pathlib import Path
from typing import Iterable, Sequence


SAMPLE_RATE = 44_100
MASTER_PEAK = 0.82
TAU = math.tau
NOTE_RE = re.compile(r"^([A-G])([#b]?)(-?\d+)$")
PITCH_CLASSES = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}


def note_frequency(note: str) -> float:
    match = NOTE_RE.match(note)
    if not match:
        raise ValueError(f"Invalid note: {note}")
    letter, accidental, octave_text = match.groups()
    pitch_class = PITCH_CLASSES[f"{letter}{accidental}"]
    midi = (int(octave_text) + 1) * 12 + pitch_class
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def equal_power_pan(pan: float) -> tuple[float, float]:
    position = (max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0
    return math.cos(position), math.sin(position)


class Song:
    def __init__(
        self,
        title: str,
        filename: str,
        bpm: float,
        bars: int,
        *,
        loopable: bool,
        key: str,
        role: str,
    ) -> None:
        self.title = title
        self.filename = filename
        self.bpm = bpm
        self.bars = bars
        self.loopable = loopable
        self.key = key
        self.role = role
        self.seconds_per_beat = 60.0 / bpm
        self.duration_seconds = bars * 4.0 * self.seconds_per_beat
        self.frames = round(self.duration_seconds * SAMPLE_RATE)
        self.left = array("f", [0.0]) * self.frames
        self.right = array("f", [0.0]) * self.frames
        self._noise_seed = 0x5A17

    def _start_frame(self, beat: float) -> int:
        return round(beat * self.seconds_per_beat * SAMPLE_RATE)

    def add_note(
        self,
        beat: float,
        beats: float,
        note: str,
        *,
        volume: float,
        wave_shape: str = "pulse",
        duty: float = 0.5,
        pan: float = 0.0,
        gate: float = 0.78,
        attack: float = 0.002,
        decay: float = 0.025,
        sustain: float = 0.78,
        release: float = 0.025,
        lowpass_hz: float | None = None,
        vibrato_hz: float = 0.0,
        vibrato_cents: float = 0.0,
        end_note: str | None = None,
    ) -> None:
        frequency = note_frequency(note)
        end_frequency = note_frequency(end_note) if end_note else frequency
        hold_seconds = max(0.001, beats * self.seconds_per_beat * gate)
        total_seconds = hold_seconds + max(0.0, release)
        sample_count = max(1, round(total_seconds * SAMPLE_RATE))
        start_frame = self._start_frame(beat)
        left_gain, right_gain = equal_power_pan(pan)
        attack_samples = max(1, round(attack * SAMPLE_RATE))
        decay_samples = max(1, round(decay * SAMPLE_RATE))
        hold_samples = max(1, round(hold_seconds * SAMPLE_RATE))
        release_samples = max(1, sample_count - hold_samples)
        lowpass_alpha = (
            1.0 - math.exp(-TAU * lowpass_hz / SAMPLE_RATE)
            if lowpass_hz
            else 1.0
        )
        phase = 0.0
        vibrato_phase = 0.0
        vibrato_increment = TAU * vibrato_hz / SAMPLE_RATE
        filtered = 0.0
        left = self.left
        right = self.right
        frames = self.frames
        loopable = self.loopable
        frame = start_frame % frames if loopable else start_frame
        slide_ratio = end_frequency / frequency

        for sample_index in range(sample_count):
            if not loopable and frame >= frames:
                break

            if sample_index < attack_samples:
                envelope = sample_index / attack_samples
            elif sample_index < attack_samples + decay_samples:
                decay_progress = (
                    sample_index - attack_samples
                ) / decay_samples
                envelope = 1.0 - (1.0 - sustain) * decay_progress
            elif sample_index < hold_samples:
                envelope = sustain
            else:
                release_progress = (
                    sample_index - hold_samples
                ) / release_samples
                envelope = sustain * max(0.0, 1.0 - release_progress)

            progress = sample_index / max(1, sample_count - 1)
            current_frequency = frequency * (slide_ratio**progress)
            if vibrato_hz and vibrato_cents:
                cents = vibrato_cents * math.sin(vibrato_phase)
                current_frequency *= 1.0 + cents * 0.00057762265
                vibrato_phase += vibrato_increment

            if wave_shape == "pulse":
                raw = 1.0 if phase < duty else -1.0
            elif wave_shape == "triangle":
                raw = 1.0 - 4.0 * abs(phase - 0.5)
            elif wave_shape == "saw":
                raw = phase * 2.0 - 1.0
            elif wave_shape == "sine":
                raw = math.sin(TAU * phase)
            else:
                raise ValueError(f"Unknown wave shape: {wave_shape}")

            filtered += lowpass_alpha * (raw - filtered)
            sample = filtered * envelope * volume
            left[frame] += sample * left_gain
            right[frame] += sample * right_gain

            phase += current_frequency / SAMPLE_RATE
            phase -= math.floor(phase)
            frame += 1
            if loopable and frame == frames:
                frame = 0

    def add_echoed_note(
        self,
        beat: float,
        beats: float,
        note: str,
        *,
        echo_beats: float,
        echo_level: float,
        **kwargs: float | str | None,
    ) -> None:
        self.add_note(beat, beats, note, **kwargs)
        echo_kwargs = dict(kwargs)
        echo_kwargs["volume"] = float(kwargs["volume"]) * echo_level
        echo_kwargs["pan"] = -float(kwargs.get("pan", 0.0))
        echo_kwargs["attack"] = max(0.002, float(kwargs.get("attack", 0.002)))
        self.add_note(beat + echo_beats, beats, note, **echo_kwargs)

    def add_kick(
        self,
        beat: float,
        *,
        volume: float = 0.24,
        duration: float = 0.115,
        pan: float = 0.0,
    ) -> None:
        sample_count = round(duration * SAMPLE_RATE)
        start_frame = self._start_frame(beat)
        left_gain, right_gain = equal_power_pan(pan)
        left = self.left
        right = self.right
        frames = self.frames
        frame = start_frame % frames if self.loopable else start_frame
        phase = 0.0
        frequency = 132.0
        frequency_ratio = (43.0 / frequency) ** (1.0 / max(1, sample_count))
        attack_samples = max(1, round(SAMPLE_RATE * 0.0015))

        for sample_index in range(sample_count):
            if not self.loopable and frame >= frames:
                break
            progress = sample_index / max(1, sample_count - 1)
            attack_envelope = min(1.0, sample_index / attack_samples)
            envelope = attack_envelope * (1.0 - progress) ** 2.4
            body = math.sin(TAU * phase)
            click = 0.0
            if sample_index < SAMPLE_RATE * 0.006:
                click = (1.0 if sample_index % 2 else -1.0) * (
                    1.0 - sample_index / (SAMPLE_RATE * 0.006)
                )
            sample = (body + click * 0.16) * envelope * volume
            left[frame] += sample * left_gain
            right[frame] += sample * right_gain
            phase += frequency / SAMPLE_RATE
            phase -= math.floor(phase)
            frequency *= frequency_ratio
            frame += 1
            if self.loopable and frame == frames:
                frame = 0

    def _next_noise(self) -> float:
        bit = (
            (self._noise_seed >> 0) ^ (self._noise_seed >> 1)
        ) & 1
        self._noise_seed = (self._noise_seed >> 1) | (bit << 14)
        return 1.0 if self._noise_seed & 1 else -1.0

    def add_hat(
        self,
        beat: float,
        *,
        volume: float = 0.04,
        duration: float = 0.035,
        pan: float = 0.0,
        open_hat: bool = False,
    ) -> None:
        if open_hat:
            duration *= 2.6
        sample_count = round(duration * SAMPLE_RATE)
        start_frame = self._start_frame(beat)
        left_gain, right_gain = equal_power_pan(pan)
        left = self.left
        right = self.right
        frames = self.frames
        frame = start_frame % frames if self.loopable else start_frame
        lowpassed = 0.0
        attack_samples = max(1, round(SAMPLE_RATE * 0.0008))

        for sample_index in range(sample_count):
            if not self.loopable and frame >= frames:
                break
            progress = sample_index / max(1, sample_count - 1)
            attack_envelope = min(1.0, sample_index / attack_samples)
            envelope = attack_envelope * (1.0 - progress) ** (
                1.8 if open_hat else 3.2
            )
            noise = self._next_noise()
            lowpassed += 0.18 * (noise - lowpassed)
            highpassed = noise - lowpassed
            metallic = highpassed * (1.0 if sample_index % 7 < 3 else -0.72)
            sample = metallic * envelope * volume
            left[frame] += sample * left_gain
            right[frame] += sample * right_gain
            frame += 1
            if self.loopable and frame == frames:
                frame = 0

    def add_snare(
        self,
        beat: float,
        *,
        volume: float = 0.085,
        duration: float = 0.105,
        pan: float = 0.0,
        rim: bool = False,
    ) -> None:
        if rim:
            duration = min(duration, 0.052)
        sample_count = round(duration * SAMPLE_RATE)
        start_frame = self._start_frame(beat)
        left_gain, right_gain = equal_power_pan(pan)
        left = self.left
        right = self.right
        frames = self.frames
        frame = start_frame % frames if self.loopable else start_frame
        lowpassed = 0.0
        phase = 0.0
        tone_frequency = 690.0 if rim else 185.0
        attack_samples = max(1, round(SAMPLE_RATE * 0.001))

        for sample_index in range(sample_count):
            if not self.loopable and frame >= frames:
                break
            progress = sample_index / max(1, sample_count - 1)
            attack_envelope = min(1.0, sample_index / attack_samples)
            envelope = attack_envelope * (1.0 - progress) ** (
                3.8 if rim else 2.2
            )
            noise = self._next_noise()
            lowpassed += 0.13 * (noise - lowpassed)
            highpassed = noise - lowpassed
            tone = 1.0 if phase < 0.5 else -1.0
            blend = highpassed * (0.48 if rim else 0.78) + tone * (
                0.52 if rim else 0.22
            )
            sample = blend * envelope * volume
            left[frame] += sample * left_gain
            right[frame] += sample * right_gain
            phase += tone_frequency / SAMPLE_RATE
            phase -= math.floor(phase)
            frame += 1
            if self.loopable and frame == frames:
                frame = 0

    def add_noise_roll(
        self,
        beat: float,
        steps: Iterable[int],
        *,
        volume: float,
    ) -> None:
        for index, step in enumerate(steps):
            self.add_snare(
                beat + step * 0.25,
                volume=volume * (0.75 + index * 0.08),
                duration=0.065,
                pan=-0.2 if index % 2 == 0 else 0.2,
            )

    def write_wav(self, output_path: Path) -> dict[str, float | int | str | bool]:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        drive = 1.18
        processed_peak = 0.0
        for left_sample, right_sample in zip(self.left, self.right):
            processed_peak = max(
                processed_peak,
                abs(math.tanh(left_sample * drive)),
                abs(math.tanh(right_sample * drive)),
            )
        gain = MASTER_PEAK / max(processed_peak, 1e-9)
        quantization_steps = 4095.0
        first_left = 0.0
        first_right = 0.0
        last_left = 0.0
        last_right = 0.0
        sum_squares = 0.0
        sample_total = self.frames * 2

        with wave.open(str(output_path), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(SAMPLE_RATE)
            chunk = bytearray()
            for frame_index, (left_sample, right_sample) in enumerate(
                zip(self.left, self.right)
            ):
                left_value = math.tanh(left_sample * drive) * gain
                right_value = math.tanh(right_sample * drive) * gain
                left_value = (
                    round(left_value * quantization_steps) / quantization_steps
                )
                right_value = (
                    round(right_value * quantization_steps) / quantization_steps
                )
                left_pcm = max(-32768, min(32767, round(left_value * 32767)))
                right_pcm = max(-32768, min(32767, round(right_value * 32767)))
                if frame_index == 0:
                    first_left = left_pcm / 32768.0
                    first_right = right_pcm / 32768.0
                last_left = left_pcm / 32768.0
                last_right = right_pcm / 32768.0
                sum_squares += left_value * left_value + right_value * right_value
                chunk.extend(struct.pack("<hh", left_pcm, right_pcm))
                if len(chunk) >= 262_144:
                    wav.writeframesraw(chunk)
                    chunk.clear()
            if chunk:
                wav.writeframesraw(chunk)

        seam_jump = max(
            abs(first_left - last_left),
            abs(first_right - last_right),
        )
        seam_jump_dbfs = (
            20.0 * math.log10(seam_jump) if seam_jump > 0.0 else -120.0
        )
        rms = math.sqrt(sum_squares / max(1, sample_total))
        rms_dbfs = 20.0 * math.log10(max(rms, 1e-12))
        return {
            "title": self.title,
            "file": output_path.name,
            "role": self.role,
            "key": self.key,
            "bpm": self.bpm,
            "bars": self.bars,
            "loop": self.loopable,
            "sample_rate": SAMPLE_RATE,
            "frames": self.frames,
            "duration_seconds": round(self.frames / SAMPLE_RATE, 6),
            "peak_dbfs": round(20.0 * math.log10(MASTER_PEAK), 2),
            "rms_dbfs": round(rms_dbfs, 2),
            "seam_jump_dbfs": round(seam_jump_dbfs, 2),
        }


def add_slot_pattern(
    song: Song,
    start_beat: float,
    slots: Sequence[str | None],
    *,
    slot_beats: float,
    volume: float,
    wave_shape: str,
    duty: float = 0.5,
    pan: float = 0.0,
    gate: float = 0.72,
    attack: float = 0.002,
    decay: float = 0.02,
    sustain: float = 0.72,
    release: float = 0.02,
    lowpass_hz: float | None = None,
    echo_beats: float | None = None,
    echo_level: float = 0.0,
    vibrato_hz: float = 0.0,
    vibrato_cents: float = 0.0,
) -> None:
    slot = 0
    while slot < len(slots):
        note = slots[slot]
        if note is None or note == "r" or note == "~":
            slot += 1
            continue
        length_slots = 1
        while slot + length_slots < len(slots) and slots[slot + length_slots] == "~":
            length_slots += 1
        kwargs = {
            "volume": volume,
            "wave_shape": wave_shape,
            "duty": duty,
            "pan": pan,
            "gate": gate,
            "attack": attack,
            "decay": decay,
            "sustain": sustain,
            "release": release,
            "lowpass_hz": lowpass_hz,
            "vibrato_hz": vibrato_hz,
            "vibrato_cents": vibrato_cents,
        }
        beat = start_beat + slot * slot_beats
        beats = length_slots * slot_beats
        if echo_beats is None:
            song.add_note(beat, beats, note, **kwargs)
        else:
            song.add_echoed_note(
                beat,
                beats,
                note,
                echo_beats=echo_beats,
                echo_level=echo_level,
                **kwargs,
            )
        slot += length_slots


def make_menu() -> Song:
    song = Song(
        "Moonlit Cartridge",
        "orc-ball-menu-moonlit-cartridge.wav",
        96,
        8,
        loopable=True,
        key="D minor",
        role="menu",
    )

    melody = [
        [("r", 0.5), ("A4", 0.5), ("D5", 1), ("E5", 0.5), ("F5", 1), ("E5", 0.5)],
        [("D5", 1), ("A4", 0.5), ("Bb4", 0.5), ("D5", 1), ("C5", 1)],
        [("A4", 1), ("C5", 0.5), ("F5", 0.5), ("E5", 1), ("C5", 1)],
        [("G4", 1), ("C5", 0.5), ("D5", 0.5), ("E5", 1), ("D5", 1)],
        [("r", 0.5), ("D5", 0.5), ("G5", 1), ("A5", 0.5), ("Bb5", 0.5), ("A5", 1)],
        [("F5", 1), ("E5", 0.5), ("D5", 0.5), ("A4", 1), ("D5", 1)],
        [("D5", 0.5), ("F5", 0.5), ("A5", 1), ("F5", 0.5), ("D5", 0.5), ("C5", 1)],
        [("E5", 1), ("D5", 0.5), ("C#5", 0.5), ("A4", 1), ("r", 1)],
    ]
    arpeggios = [
        ["D4", "A4", "E5", "F5", "A4", "E5", "F5", "A4"],
        ["Bb3", "F4", "A4", "D5", "F4", "A4", "D5", "F5"],
        ["A3", "C4", "F4", "A4", "C5", "A4", "F4", "C4"],
        ["C4", "G4", "D5", "E5", "G4", "D5", "E5", "G5"],
        ["G3", "D4", "A4", "Bb4", "D5", "A4", "Bb4", "D5"],
        ["F3", "A3", "D4", "F4", "A4", "D5", "A4", "F4"],
        ["Bb3", "F4", "A4", "D5", "F5", "D5", "A4", "F4"],
        ["A3", "E4", "G4", "D5", "A3", "E4", "G4", "C#5"],
    ]
    bass = [
        ["D2", "A2", "D3", "A2"],
        ["Bb1", "F2", "Bb2", "F2"],
        ["A1", "E2", "A2", "E2"],
        ["C2", "G2", "C3", "G2"],
        ["G1", "D2", "G2", "D2"],
        ["F2", "A2", "F3", "A2"],
        ["Bb1", "F2", "Bb2", "F2"],
        ["A1", "E2", "A2", "E2"],
    ]

    for bar_index in range(8):
        bar_beat = bar_index * 4.0
        cursor = bar_beat
        for note, length in melody[bar_index]:
            if note != "r":
                song.add_echoed_note(
                    cursor,
                    length,
                    note,
                    volume=0.115,
                    wave_shape="pulse",
                    duty=0.125,
                    pan=-0.18,
                    gate=0.82,
                    attack=0.003,
                    decay=0.045,
                    sustain=0.72,
                    release=0.085,
                    lowpass_hz=6_800,
                    vibrato_hz=4.8 if length >= 1 else 0.0,
                    vibrato_cents=6.0 if length >= 1 else 0.0,
                    echo_beats=0.75,
                    echo_level=0.18,
                )
            cursor += length

        add_slot_pattern(
            song,
            bar_beat,
            arpeggios[bar_index],
            slot_beats=0.5,
            volume=0.052 if bar_index < 4 else 0.062,
            wave_shape="pulse",
            duty=0.25,
            pan=0.26,
            gate=0.46,
            attack=0.002,
            decay=0.025,
            sustain=0.55,
            release=0.025,
            lowpass_hz=5_400,
        )
        add_slot_pattern(
            song,
            bar_beat,
            bass[bar_index],
            slot_beats=1.0,
            volume=0.12,
            wave_shape="pulse",
            duty=0.5,
            pan=0.0,
            gate=0.54,
            attack=0.004,
            decay=0.055,
            sustain=0.62,
            release=0.045,
            lowpass_hz=2_200,
        )
        for beat_in_bar in (0.0, 2.0):
            song.add_kick(bar_beat + beat_in_bar, volume=0.16, duration=0.105)
        song.add_snare(
            bar_beat + 3.0,
            volume=0.042,
            duration=0.05,
            pan=0.08,
            rim=True,
        )
        hat_offsets = (1.5, 3.5) if bar_index < 4 else (0.5, 1.5, 2.5, 3.5)
        for hat_index, offset in enumerate(hat_offsets):
            song.add_hat(
                bar_beat + offset,
                volume=0.022 if bar_index < 4 else 0.029,
                duration=0.032,
                pan=-0.28 if hat_index % 2 == 0 else 0.28,
            )

    song.add_noise_roll(31.0, (0, 1, 2, 3), volume=0.024)
    return song


def make_gameplay() -> Song:
    song = Song(
        "Coin-Op Chase",
        "orc-ball-gameplay-coin-op-chase.wav",
        128,
        8,
        loopable=True,
        key="A minor",
        role="gameplay",
    )
    lead = [
        ["E5", "r", "E5", "G5", "A5", "~", "G5", "E5"],
        ["C5", "r", "C5", "E5", "F5", "~", "E5", "C5"],
        ["G5", "E5", "G5", "A5", "G5", "E5", "D5", "C5"],
        ["D5", "r", "D5", "G5", "F5", "D5", "B4", "r"],
        ["E5", "r", "E5", "G5", "A5", "C6", "B5", "A5"],
        ["A5", "F5", "E5", "C5", "F5", "E5", "C5", "A4"],
        ["F5", "A5", "C6", "A5", "F5", "E5", "D5", "F5"],
        ["G#5", "B5", "E6", "B5", "G#5", "E5", "D5", "B4"],
    ]
    arp_cells = {
        "Am": ["A3", "C4", "E4", "C4", "A3", "C4", "E4", "A4", "A3", "E4", "C4", "E4", "A3", "C4", "E4", "A4"],
        "F": ["F3", "A3", "C4", "A3", "F3", "A3", "C4", "F4", "F3", "C4", "A3", "C4", "F3", "A3", "C4", "F4"],
        "C": ["C4", "E4", "G4", "E4", "C4", "E4", "G4", "C5", "C4", "G4", "E4", "G4", "C4", "E4", "G4", "C5"],
        "G": ["G3", "B3", "D4", "B3", "G3", "B3", "D4", "G4", "G3", "D4", "B3", "D4", "G3", "B3", "D4", "G4"],
        "Dm": ["D3", "F3", "A3", "F3", "D3", "F3", "A3", "D4", "D3", "A3", "F3", "A3", "D3", "F3", "A3", "D4"],
        "E7": ["E3", "G#3", "B3", "G#3", "E3", "G#3", "D4", "B3", "E3", "B3", "G#3", "D4", "E3", "G#3", "B3", "E4"],
    }
    progression = ["Am", "F", "C", "G", "Am", "F", "Dm", "E7"]
    bass = [
        ["A2", "A2", "A3", "r", "A2", "E3", "A3", "r"],
        ["F2", "F2", "F3", "r", "F2", "C3", "F3", "r"],
        ["C2", "C2", "C3", "r", "C2", "G2", "C3", "r"],
        ["G2", "G2", "G3", "r", "G2", "D3", "G3", "r"],
        ["A2", "A2", "A3", "r", "A2", "E3", "A3", "r"],
        ["F2", "F2", "F3", "r", "F2", "C3", "F3", "r"],
        ["D2", "D2", "D3", "r", "D2", "A2", "D3", "r"],
        ["E2", "E2", "E3", "r", "E2", "B2", "G#2", "B2"],
    ]

    for bar_index in range(8):
        bar_beat = bar_index * 4.0
        add_slot_pattern(
            song,
            bar_beat,
            lead[bar_index],
            slot_beats=0.5,
            volume=0.105,
            wave_shape="pulse",
            duty=0.25,
            pan=-0.22,
            gate=0.67,
            attack=0.0015,
            decay=0.025,
            sustain=0.72,
            release=0.026,
            lowpass_hz=7_600,
            echo_beats=0.75,
            echo_level=0.13,
        )
        add_slot_pattern(
            song,
            bar_beat,
            arp_cells[progression[bar_index]],
            slot_beats=0.25,
            volume=0.040,
            wave_shape="pulse",
            duty=0.125,
            pan=0.28,
            gate=0.44,
            attack=0.001,
            decay=0.012,
            sustain=0.54,
            release=0.012,
            lowpass_hz=6_400,
        )
        add_slot_pattern(
            song,
            bar_beat,
            bass[bar_index],
            slot_beats=0.5,
            volume=0.132,
            wave_shape="pulse",
            duty=0.5,
            pan=0.0,
            gate=0.45,
            attack=0.002,
            decay=0.035,
            sustain=0.68,
            release=0.018,
            lowpass_hz=2_600,
        )
        for step in (1, 5, 9, 13):
            song.add_kick(bar_beat + (step - 1) * 0.25, volume=0.19)
        for step in (5, 13):
            song.add_snare(
                bar_beat + (step - 1) * 0.25,
                volume=0.069,
                pan=0.06,
            )
        for step in (1, 3, 5, 7, 9, 11, 13, 15):
            accented = step in (3, 7, 11, 15)
            open_hat = step == 15 and bar_index in (1, 3, 5)
            song.add_hat(
                bar_beat + (step - 1) * 0.25,
                volume=0.030 if accented else 0.020,
                duration=0.035,
                pan=-0.3 if step % 4 == 1 else 0.3,
                open_hat=open_hat,
            )

    song.add_noise_roll(31.0, (0, 1, 2, 3), volume=0.058)
    return song


def make_danger() -> Song:
    song = Song(
        "One Heart Left",
        "orc-ball-danger-one-heart-left.wav",
        144,
        8,
        loopable=True,
        key="E Phrygian",
        role="danger",
    )
    lead = [
        ["B5", "G5", "E5", "F5", "G5", "B5", "A5", "G5"],
        ["C6", "A5", "F5", "E5", "F5", "A5", "G5", "F5"],
        ["B5", "G5", "E5", "D5", "E5", "G5", "F5", "E5"],
        ["C6", "A5", "F5", "G5", "A5", "C6", "B5", "A5"],
        ["G5", "E5", "C5", "D5", "E5", "G5", "F5", "E5"],
        ["A5", "F5", "D5", "E5", "F5", "A5", "G5", "F5"],
        ["F#5", "D#5", "B4", "C5", "D#5", "F#5", "A5", "F#5"],
        ["B5", "A5", "F#5", "D#5", "B4", "D#5", "F#5", "D#5"],
    ]
    arp_cells = {
        "Em": ["E4", "B4", "F4", "B4", "E4", "G4", "B4", "G4", "E4", "B4", "F4", "B4", "E4", "G4", "B4", "E5"],
        "F": ["F4", "C5", "E4", "C5", "F4", "A4", "C5", "A4", "F4", "C5", "E4", "C5", "F4", "A4", "C5", "F5"],
        "C": ["C4", "G4", "D4", "G4", "C4", "E4", "G4", "E4", "C4", "G4", "D4", "G4", "C4", "E4", "G4", "C5"],
        "Dm": ["D4", "A4", "E4", "A4", "D4", "F4", "A4", "F4", "D4", "A4", "E4", "A4", "D4", "F4", "A4", "D5"],
        "B7": ["B3", "F#4", "C4", "F#4", "B3", "D#4", "F#4", "D#4", "B3", "A4", "F#4", "D#4", "B3", "D#4", "F#4", "B4"],
    }
    progression = ["Em", "F", "Em", "F", "C", "Dm", "B7", "B7"]
    bass = [
        ["E2", "E3", "E2", "B2", "E2", "E3", "F2", "B2"],
        ["F2", "F3", "F2", "C3", "E2", "F2", "C3", "E2"],
        ["E2", "E3", "E2", "B2", "E2", "E3", "D2", "B2"],
        ["F2", "F3", "F2", "C3", "E2", "F2", "C3", "E2"],
        ["C2", "C3", "G2", "C3", "C2", "G2", "B2", "C3"],
        ["D2", "D3", "A2", "D3", "D2", "A2", "E2", "F2"],
        ["B1", "B2", "F#2", "B2", "B1", "F#2", "C2", "D#2"],
        ["B1", "B2", "F#2", "A2", "B2", "F#2", "D#2", "B1"],
    ]

    for bar_index in range(8):
        bar_beat = bar_index * 4.0
        add_slot_pattern(
            song,
            bar_beat,
            lead[bar_index],
            slot_beats=0.5,
            volume=0.092,
            wave_shape="pulse",
            duty=0.125,
            pan=-0.24,
            gate=0.56,
            attack=0.001,
            decay=0.018,
            sustain=0.66,
            release=0.018,
            lowpass_hz=6_900,
            echo_beats=0.5,
            echo_level=0.10,
        )
        add_slot_pattern(
            song,
            bar_beat,
            arp_cells[progression[bar_index]],
            slot_beats=0.25,
            volume=0.036,
            wave_shape="pulse",
            duty=0.25,
            pan=0.26,
            gate=0.40,
            attack=0.001,
            decay=0.010,
            sustain=0.52,
            release=0.010,
            lowpass_hz=5_800,
        )
        add_slot_pattern(
            song,
            bar_beat,
            bass[bar_index],
            slot_beats=0.5,
            volume=0.128,
            wave_shape="pulse",
            duty=0.5,
            pan=0.0,
            gate=0.38,
            attack=0.0015,
            decay=0.026,
            sustain=0.67,
            release=0.015,
            lowpass_hz=2_350,
        )
        kick_steps = [1, 4, 7, 9, 12, 13]
        if bar_index in (3, 7):
            kick_steps.append(15)
        for step in kick_steps:
            song.add_kick(
                bar_beat + (step - 1) * 0.25,
                volume=0.18,
                duration=0.105,
            )
        for step in (5, 13):
            song.add_snare(
                bar_beat + (step - 1) * 0.25,
                volume=0.067,
                pan=0.05,
            )
        song.add_snare(
            bar_beat + (10 - 1) * 0.25,
            volume=0.026,
            duration=0.065,
            pan=-0.14,
        )
        for step in range(1, 17):
            if step in (8, 16):
                song.add_hat(
                    bar_beat + (step - 1) * 0.25,
                    volume=0.030,
                    duration=0.027,
                    pan=0.32 if step == 8 else -0.32,
                    open_hat=True,
                )
            else:
                song.add_hat(
                    bar_beat + (step - 1) * 0.25,
                    volume=0.016 if step % 2 else 0.024,
                    duration=0.022,
                    pan=-0.25 if step % 4 < 2 else 0.25,
                )

    song.add_noise_roll(31.0, (0, 1, 2, 3), volume=0.061)
    return song


def make_level_clear() -> Song:
    song = Song(
        "Gem Secured",
        "orc-ball-level-clear-gem-secured.wav",
        128,
        2,
        loopable=False,
        key="A major lift",
        role="level-clear",
    )
    lead = [
        ["A4", "C5", "F5", "A5", "B4", "D5", "G5", "B5"],
        ["C#5", "E5", "A5", "C#6", "A5", "~", "~", "~"],
    ]
    second_pulse = [
        ["F4", "A4", "C5", "A4", "F4", "A4", "C5", "F5", "G4", "B4", "D5", "B4", "G4", "B4", "D5", "G5"],
        ["A4", "C#5", "E5", "A5", "C#5", "E5", "A5", "C#6", "A4", "~", "~", "~", "A4", "~", "~", "~"],
    ]
    bass = [
        ["F2", "F3", "C3", "F2", "G2", "G3", "D3", "G2"],
        ["A2", "A3", "E3", "A2", "A2", "~", "~", "~"],
    ]

    for bar_index in range(2):
        bar_beat = bar_index * 4.0
        add_slot_pattern(
            song,
            bar_beat,
            lead[bar_index],
            slot_beats=0.5,
            volume=0.12,
            wave_shape="pulse",
            duty=0.25,
            pan=-0.2,
            gate=0.68 if bar_index == 0 else 0.78,
            attack=0.0015,
            decay=0.025,
            sustain=0.74,
            release=0.08 if bar_index == 1 else 0.025,
            lowpass_hz=7_600,
        )
        add_slot_pattern(
            song,
            bar_beat,
            second_pulse[bar_index],
            slot_beats=0.25,
            volume=0.055,
            wave_shape="pulse",
            duty=0.125,
            pan=0.25,
            gate=0.50,
            attack=0.001,
            decay=0.014,
            sustain=0.58,
            release=0.018,
            lowpass_hz=6_400,
        )
        add_slot_pattern(
            song,
            bar_beat,
            bass[bar_index],
            slot_beats=0.5,
            volume=0.13,
            wave_shape="pulse",
            duty=0.5,
            pan=0.0,
            gate=0.52,
            attack=0.002,
            decay=0.035,
            sustain=0.70,
            release=0.05,
            lowpass_hz=2_600,
        )

    for step in (1, 9, 13):
        song.add_kick((step - 1) * 0.25, volume=0.18)
    for step in (5, 13):
        song.add_snare((step - 1) * 0.25, volume=0.065)
    for step in range(1, 16, 2):
        song.add_hat(
            (step - 1) * 0.25,
            volume=0.021 if step % 4 == 1 else 0.028,
            pan=-0.26 if step % 4 == 1 else 0.26,
        )
    for step in (1, 5, 9):
        song.add_kick(4.0 + (step - 1) * 0.25, volume=0.19)
    song.add_snare(5.0, volume=0.07)
    for step in (9, 11, 13, 14, 15):
        song.add_snare(
            4.0 + (step - 1) * 0.25,
            volume=0.032 + step * 0.0022,
            duration=0.055,
            pan=-0.25 if step % 2 else 0.25,
        )

    # Final major chord reinforces the Picardy-third lift.
    for note, pan in (("A4", -0.24), ("C#5", -0.08), ("E5", 0.10), ("A5", 0.25)):
        song.add_note(
            6.0,
            1.75,
            note,
            volume=0.055,
            wave_shape="pulse",
            duty=0.25,
            pan=pan,
            gate=0.83,
            attack=0.003,
            decay=0.08,
            sustain=0.62,
            release=0.12,
            lowpass_hz=6_800,
        )
    return song


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "audio",
    )
    args = parser.parse_args()
    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    manifests: list[dict[str, float | int | str | bool]] = []
    makers = (make_menu, make_gameplay, make_danger, make_level_clear)
    for make_song in makers:
        song = make_song()
        output_path = output_dir / song.filename
        print(f"Rendering {song.title} -> {output_path}")
        manifests.append(song.write_wav(output_path))

    manifest_path = output_dir / "orc-ball-music-manifest.json"
    manifest_path.write_text(
        json.dumps({"tracks": manifests}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"manifest": str(manifest_path), "tracks": manifests}, indent=2))


if __name__ == "__main__":
    main()
