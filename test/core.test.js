import { test } from "node:test";
import assert from "node:assert/strict";

import { intToHex, hexToInt } from "../src/core.js";

// ---- intToHex: happy path ------------------------------------------------

test("intToHex encodes small unsigned values", () => {
  assert.equal(intToHex(0, 8), "0x00");
  assert.equal(intToHex(15, 8), "0x0f");
  assert.equal(intToHex(255, 8), "0xff");
});

test("intToHex encodes small signed values", () => {
  assert.equal(intToHex(-1, 8), "0xff");
  assert.equal(intToHex(-128, 8), "0x80");
  assert.equal(intToHex(127, 8), "0x7f");
});

test("intToHex accepts bigint and decimal string inputs", () => {
  assert.equal(intToHex(200n, 8), "0xc8");
  assert.equal(intToHex("200", 8), "0xc8");
});

test("intToHex pads to byte boundary for non-byte bit lengths", () => {
  // 12 bits fits 0..4095; ceil(12/4)=3 hex digits, padded to even = 4 digits.
  assert.equal(intToHex(0, 12), "0x0000");
  assert.equal(intToHex(1, 12), "0x0001");
  assert.equal(intToHex(4095, 12), "0x0fff");
});

test("intToHex produces even-length output for odd-digit values", () => {
  // 0x0f00 has 4 digits; 0x0fff has 4 digits; the awkward case is a value
  // whose natural hex length is odd, e.g. 0x100 -> we want 0x0100.
  assert.equal(intToHex(256, 16), "0x0100");
  // 20 bits: ceil(20/8)=3 bytes = 6 hex digits, so 4096 pads to 0x001000.
  assert.equal(intToHex(4096, 20), "0x001000");
});

// ---- intToHex: error cases ------------------------------------------------

test("intToHex rejects non-positive bitLength", () => {
  assert.throws(() => intToHex(1, 0), RangeError);
  assert.throws(() => intToHex(1, -8), RangeError);
  assert.throws(() => intToHex(1, 1.5), RangeError);
});

test("intToHex rejects unsafe number inputs", () => {
  assert.throws(() => intToHex(2 ** 53, 64), TypeError);
  assert.throws(() => intToHex(1.5, 8), TypeError);
});

test("intToHex rejects non-decimal string inputs", () => {
  assert.throws(() => intToHex("0x10", 8), TypeError);
  assert.throws(() => intToHex("1e3", 8), TypeError);
});

test("intToHex rejects values out of range", () => {
  // 8-bit unsigned max is 255; signed min is -128.
  assert.throws(() => intToHex(256, 8), RangeError);
  assert.throws(() => intToHex(-129, 8), RangeError);
});

// ---- hexToInt: happy path -------------------------------------------------

test("hexToInt decodes unsigned values", () => {
  assert.equal(hexToInt("0x00", 8), 0);
  assert.equal(hexToInt("0x0f", 8), 15);
  assert.equal(hexToInt("0xff", 8), 255);
});

test("hexToInt decodes signed values when signed=true", () => {
  assert.equal(hexToInt("0xff", 8, true), -1);
  assert.equal(hexToInt("0x80", 8, true), -128);
  assert.equal(hexToInt("0x7f", 8, true), 127);
});

test("hexToInt trims surrounding whitespace", () => {
  assert.equal(hexToInt("  0x1f  ", 8), 31);
});

test("hexToInt accepts uppercase 0X prefix and digits", () => {
  assert.equal(hexToInt("0XFF", 8), 255);
});

test("hexToInt rejects values exceeding bitLength", () => {
  assert.throws(() => hexToInt("0x100", 8), RangeError);
});

test("hexToInt rejects non-string input", () => {
  assert.throws(() => hexToInt(0xff, 8), TypeError);
});

test("hexToInt rejects missing 0x prefix", () => {
  assert.throws(() => hexToInt("ff", 8), SyntaxError);
});

test("hexToInt rejects internal whitespace", () => {
  assert.throws(() => hexToInt("0x ff", 8), SyntaxError);
});

test("hexToInt rejects bitLength beyond 53-bit Number safety", () => {
  assert.throws(() => hexToInt("0x00", 54), RangeError);
});

// ---- round trip ----------------------------------------------------------

test("round trip: intToHex -> hexToInt recovers value", () => {
  for (const v of [0, 1, 15, 127, 200, 255]) {
    assert.equal(hexToInt(intToHex(v, 8), 8), v);
  }
  for (const v of [-128, -1, 0, 127]) {
    assert.equal(hexToInt(intToHex(v, 8), 8, true), v);
  }
});
