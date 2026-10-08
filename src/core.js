/**
 * Core conversion logic for int-hex-string.
 *
 * Single interpretation chosen: a "bit length" parameter on every call.
 * We do NOT sniff bit length from the integer's magnitude, and we do NOT
 * default to 32. The caller must state how many bits the two's complement
 * representation occupies. This removes every ambiguity around sign and
 * width, at the cost of one extra argument. We picked this because every
 * other choice (magic defaults, inferring width, accepting signedness as a
 * separate flag) forces the library to guess in at least one direction,
 * and guessing is what makes hex conversion libraries disagree with their
 * own tests.
 */

/**
 * Largest unsigned integer storable in `bitLength` bits.
 * @param {number} bitLength
 * @returns {bigint}
 */
function _maxUnsigned(bitLength) {
  // (1n << bitLength) is correct for bitLength >= 1. We validate the input
  // at the public API boundary, so by the time we get here bitLength is sane.
  return (1n << BigInt(bitLength)) - 1n;
}

/**
 * Mask used to wrap a value into `bitLength` bits.
 * @param {number} bitLength
 * @returns {bigint}
 */
function _mask(bitLength) {
  return (1n << BigInt(bitLength)) - 1n;
}

/**
 * Converts an integer to an even-length, lowercase, 0x-prefixed hex string.
 *
 * `bitLength` controls two things: the minimum width of the output and the
 * range of valid inputs. Negative integers are interpreted as two's complement
 * values of the given width and encoded as their unsigned bit pattern.
 *
 * The output is always an even number of hex digits so that each byte is
 * represented by exactly two characters; this is the convention used by most
 * binary tooling and avoids the ambiguity of "0xff" vs "0x0ff".
 *
 * @param {number|bigint} value - integer to encode; coerced via BigInt().
 * @param {number} bitLength - width of the representation in bits.
 * @returns {string} 0x-prefixed lowercase hex with an even digit count.
 * @throws {TypeError} if `value` is not an integer.
 * @throws {RangeError} if `bitLength` is not a positive integer.
 * @throws {RangeError} if `value` is out of range for `bitLength`.
 */
export function intToHex(value, bitLength) {
  if (typeof bitLength !== "number" || !Number.isInteger(bitLength) || bitLength <= 0) {
    throw new RangeError(`bitLength must be a positive integer, got ${bitLength}`);
  }

  // BigInt() accepts numbers, bigints, and numeric strings. We refuse anything
  // that is not already a safe integer, a bigint, or a decimal string, because
  // silently coercing "0x10" or "1e3" would hide caller bugs.
  let v;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`number value must be a safe integer, got ${value}`);
    }
    v = BigInt(value);
  } else if (typeof value === "bigint") {
    v = value;
  } else if (typeof value === "string") {
    if (!/^-?[0-9]+$/.test(value)) {
      throw new TypeError(`string value must be a decimal integer, got ${value}`);
    }
    v = BigInt(value);
  } else {
    throw new TypeError(`value must be number, bigint, or decimal string, got ${typeof value}`);
  }

  const bitLenBig = BigInt(bitLength);
  const maxUnsigned = _maxUnsigned(bitLength);
  const minSigned = -(1n << (bitLenBig - 1n));
  const maxSigned = (1n << (bitLenBig - 1n)) - 1n;

  // Reject anything outside [-2^(n-1), 2^n - 1]. We deliberately permit BOTH
  // the signed and the unsigned interpretation of the range for the given bit
  // width, because a caller asking for 8 bits may legitimately want to store
  // 200 (unsigned) or -56 (signed, same bit pattern). What we refuse is
  // silently truncating 300 to a narrower bit pattern.
  if (v < minSigned || v > maxUnsigned) {
    throw new RangeError(
      `value ${v} out of range for ${bitLength}-bit field [${minSigned}, ${maxUnsigned}]`
    );
  }

  // Fold negatives into their unsigned two's complement bit pattern.
  const unsigned = v < 0n ? (v + (1n << bitLenBig)) & _mask(bitLength) : v;

  // Hex digits, lowercase, no sign, no 0x yet.
  let hex = unsigned.toString(16);

  // Even length: pad to a whole number of bytes. The minimum width is also
  // `ceil(bitLength / 8)` bytes, so for bitLength=12 we get 2 bytes (4 hex
  // digits), which is enough to hold the value and keeps byte alignment.
  const minDigits = Math.ceil(bitLength / 4);
  const targetDigits = minDigits % 2 === 0 ? minDigits : minDigits + 1;
  if (hex.length < targetDigits) {
    hex = hex.padStart(targetDigits, "0");
  } else if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }

  return "0x" + hex;
}

/**
 * Parses a hex string into a Number, choosing signedness per call.
 *
 * We require a "0x" or "0X" prefix. This is a deliberate narrowing: bare hex
 * digits are a common source of off-by-one bugs (e.g. a caller forgetting the
 * prefix and silently getting a different value), so we refuse rather than
 * guess. If you have bare hex, prepend "0x" yourself.
 *
 * `signed` defaults to `false` (unsigned). When `signed` is true and the
 * string's most significant bit (within `bitLength`) is set, the value is
 * interpreted as a two's complement negative.
 *
 * @param {string} hex - a 0x-prefixed hex string, even or odd digit count.
 * @param {number} bitLength - width to interpret the value as, in bits.
 * @param {boolean} [signed=false] - interpret as two's complement when true.
 * @returns {number} the decoded integer as a JS Number.
 * @throws {TypeError} if `hex` is not a string.
 * @throws {SyntaxError} if `hex` is malformed or lacks the 0x prefix.
 * @throws {RangeError} if `bitLength` is not a positive integer or is too small.
 */
export function hexToInt(hex, bitLength, signed = false) {
  if (typeof hex !== "string") {
    throw new TypeError(`hex must be a string, got ${typeof hex}`);
  }
  if (typeof bitLength !== "number" || !Number.isInteger(bitLength) || bitLength <= 0) {
    throw new RangeError(`bitLength must be a positive integer, got ${bitLength}`);
  }
  if (typeof signed !== "boolean") {
    throw new TypeError(`signed must be a boolean, got ${typeof signed}`);
  }

  // Strip optional whitespace; we don't want to reject "  0x1f  " but we do
  // reject internal whitespace like "0x 1f".
  const trimmed = hex.trim();
  if (!/^(0x|0X)[0-9a-fA-F]+$/.test(trimmed)) {
    throw new SyntaxError(`hex must be 0x-prefixed hexadecimal, got ${JSON.stringify(hex)}`);
  }

  const digits = trimmed.slice(2).toLowerCase();
  const parsed = BigInt("0x" + digits);

  const bitLenBig = BigInt(bitLength);
  const maxUnsigned = _maxUnsigned(bitLength);

  if (parsed > maxUnsigned) {
    throw new RangeError(
      `value ${parsed} exceeds ${bitLength}-bit maximum ${maxUnsigned}`
    );
  }

  let result = parsed;
  if (signed) {
    const signBit = 1n << (bitLenBig - 1n);
    if (parsed & signBit) {
      // Two's complement: subtract 2^bitLength to recover the negative value.
      result = parsed - (1n << bitLenBig);
    }
  }

  // We return a Number. BigInt is the right tool for parsing and masking, but
  // the API contract is Number, and we have already ranged the value into a
  // width that fits in a safe integer (bitLength <= 53 for unsigned, <= 54 for
  // signed). Enforce that ceiling here so we never return an unsafe Number.
  if (bitLength > 53) {
    throw new RangeError(
      `hexToInt returns a Number; bitLength ${bitLength} exceeds 53 bits of safe precision`
    );
  }

  return Number(result);
}
