---
title: "LACTF ooo — Unicode Homoglyph Reverse Engineering Challenge"
description: "Surely everyone knows the difference between the Cyrillic small letter o, the Greek small letter omicron, and the Latin small letter o, right?"
date: "2026-02-11"
tags: ["Reverse Engineering", "CTF", "LACTF"]
readTime: "10 min read"
---

## First Look

We're given a Python script where every function and most variables are named with different Unicode characters that all *look* like the letter "o." The entire challenge is an exercise in homoglyph confusion — characters from Cyrillic, Greek, Armenian, Latin with diacritics, and other scripts that are visually indistinguishable in most fonts.

Here are the 11 functions defined at the top, each named with a different 'o':

| Character | Unicode | Function |
|-----------|---------|----------|
| о | U+043E (Cyrillic) | `a + b` |
| ο | U+03BF (Greek omicron) | `a - b` |
| օ | U+0585 (Armenian) | `a * b` |
| ỏ | U+1ECF (Latin w/ hook) | `a // b` |
| ơ | U+01A1 (Latin w/ horn) | `a ^ b` (XOR) |
| ó | U+00F3 (Latin w/ acute) | `a \| b` (OR) |
| ὀ | U+1F40 (Greek w/ psili) | `a & b` (AND) |
| ὸ | U+1F78 (Greek w/ varia) | `b - a` |
| ὄ | U+1F44 (Greek w/ psili+oxia) | `a` (returns first) |
| ὂ | U+1F42 (Greek w/ psili+varia) | `b` (returns second) |
| ȯ | U+022F (Latin w/ dot above) | `a % b` |

There's also a target array `ὁ` (U+1F41, yet another 'o') containing 27 integers:

```python
ὁ = [205, 196, 215, 218, 225, 226, 1189, 2045, 2372, 9300, 8304, 660,
     8243, 16057, 16113, 16057, 16004, 16007, 16006, 8561, 805, 346,
     195, 201, 154, 146, 223]
```

## The Verification Loop

The core logic iterates over adjacent pairs of characters in our input:

```python
for ö in range(len(ὁ)-1):
    ό = ord(guess[ö])
    ὃ = ord(guess[ö+1])
    if (о(ὄ(ό,ὃ),ὂ(ό,ὃ)) != ὁ[ơ(ö,ȯ(օ(ό,ὃ),ό))]):
        print("That's not the flag :(")
        exit()
```

The key challenge is untangling which 'o' is which. Using the Unicode codepoints to disambiguate:

- `ö` (U+00F6) — loop index `i`
- `ό` (U+03CC) — `ord(guess[i])`
- `ὃ` (U+1F43) — `ord(guess[i+1])`

## Simplifying the Check

**Left side:** `о(ὄ(ό,ὃ), ὂ(ό,ὃ))`

Working inside-out:
- `ὄ(ό, ὃ)` → returns first arg → `ό`
- `ὂ(ό, ὃ)` → returns second arg → `ὃ`
- `о(ό, ὃ)` → addition → `ό + ὃ`

So the **left side** is just `ord(guess[i]) + ord(guess[i+1])`.

**Right side index:** `ơ(ö, ȯ(օ(ό,ὃ), ό))`

Again inside-out:
- `օ(ό, ὃ)` → multiplication → `ό * ὃ`
- `ȯ(ό * ὃ, ό)` → modulo → `(ό * ὃ) % ό`

Since `ό * ὃ` is always divisible by `ό` (for any nonzero integer), this modulo is **always 0**.

- `ơ(ö, 0)` → XOR → `ö ^ 0` → just `ö`

So the **index** simplifies to just `i`.

**The entire check reduces to:**

```
ord(guess[i]) + ord(guess[i+1]) == target[i]
```

## Solving

This gives us a simple recurrence. Since we know the flag starts with `lactf{` (i.e., `guess[0] = 'l'`), we can chain forward:

```python
guess[i+1] = target[i] - ord(guess[i])
```

```python
target = [205, 196, 215, 218, 225, 226, 1189, 2045, 2372, 9300,
          8304, 660, 8243, 16057, 16113, 16057, 16004, 16007,
          16006, 8561, 805, 346, 195, 201, 154, 146, 223]

flag = [ord('l')]  # Start with 'l' = 108
for i in range(len(target)):
    flag.append(target[i] - flag[-1])

print(''.join(chr(c) for c in flag))
```

This produces a 28-character string that starts with `lactf{` and ends with `}`. The characters in between are — fittingly — all different Unicode 'o' homoglyphs:

| Position | Codepoint | Unicode Name |
|----------|-----------|-------------|
| 6 | U+0067 | LATIN SMALL LETTER G |
| 7 | U+043E | CYRILLIC SMALL LETTER O |
| 8 | U+03BF | GREEK SMALL LETTER OMICRON |
| 9 | U+0585 | ARMENIAN SMALL LETTER OH |
| 10 | U+1ECF | LATIN SMALL LETTER O WITH HOOK ABOVE |
| 11 | U+01A1 | LATIN SMALL LETTER O WITH HORN |
| 12 | U+00F3 | LATIN SMALL LETTER O WITH ACUTE |
| 13 | U+1F40 | GREEK SMALL LETTER OMICRON WITH PSILI |
| 14 | U+1F79 | GREEK SMALL LETTER OMICRON WITH OXIA |
| 15 | U+1F78 | GREEK SMALL LETTER OMICRON WITH VARIA |
| 16 | U+1F41 | GREEK SMALL LETTER OMICRON WITH DASIA |
| 17 | U+1F43 | GREEK SMALL LETTER OMICRON WITH DASIA AND VARIA |
| 18 | U+1F44 | GREEK SMALL LETTER OMICRON WITH PSILI AND OXIA |
| 19 | U+1F42 | GREEK SMALL LETTER OMICRON WITH PSILI AND VARIA |
| 20 | U+022F | LATIN SMALL LETTER O WITH DOT ABOVE |
| 21 | U+00F6 | LATIN SMALL LETTER O WITH DIAERESIS |
| 22–27 | ASCII | `d_j0b}` |

Reading the ASCII characters: **g...d_j0b** → "good job" — spelled with every 'o' variant used in the challenge source code.

## Gotcha: Unicode Normalization

The biggest practical hurdle isn't the math — it's submitting the flag. Many terminals and text editors perform **Unicode normalization** (NFC/NFD), which silently replaces characters like U+1F79 (ό with oxia) with U+03CC (ό with tonos). These look identical but have different codepoints, so the checker rejects the input.

The safest approach is to pipe the flag directly from Python into the checker, or generate it programmatically and feed it via stdin, bypassing any terminal normalization.

## Flag

```
lactf{gоοօỏơóὀόὸὁὃὄὂȯöd_j0b}
```

(28 characters, 16 of which are different Unicode variants of 'o')
