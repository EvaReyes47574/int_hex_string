# int-hex-string

Converts unsigned integers to and from hexadecimal strings with configurable two's complement signed handling. Every call takes an explicit `bitLength`; the library never guesses width.

```js
import { intToHex, hexToInt } from "int-hex-string";

intToHex(255, 8);          // "0xff"
intToHex(-1, 8);           // "0xff"  (two's complement in 8 bits)
hexToInt("0xff", 8);       // 255
hexToInt("0xff", 8, true);  // -1     (interpreted as signed 8-bit)
```

## Why this exists

Binary protocols, hash registers, and on-disk byte formats all need integers rendered as hex, and they disagree about sign and width. A library that defaults to 32 bits, or that tries to infer width from the integer's magnitude, will silently misencode anything outside that default. This library makes the caller state `bitLength` on every call and refuses values that don't fit. That is one extra argument and one less class of bug.

Encoding always produces an even number of hex digits (whole bytes) so output lines up with byte-oriented tooling. Negative inputs are folded into their unsigned two's complement bit pattern at the given width; decoding is unsigned unless you pass `signed: true`.

## The awkward edge

`hexToInt` returns a JS `Number`, not a `BigInt`. That caps useful `bitLength` at 53 bits; larger widths throw `RangeError`. If you need 64-bit values out, reach for a BigInt-based library. This ceiling is enforced, not silent.

`hexToInt` also requires a `0x` / `0X` prefix. Bare hex is refused, because a missing prefix is the most common cause of silent off-by-one decoding bugs in hex-handling code.
