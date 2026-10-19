// Bounded parser for rational polynomial expressions. No eval, random sampling,
// or text similarity: only identities within the supported grammar are graded.
function normalize(value) {
  return String(value ?? "")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .normalize("NFKC")
    .replace(/[\s$]/g, "")
    .replace(/\\(?:d?frac)\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\^\{(\d+)\}/g, "^$1")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1)/100")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");
}
function fraction(n, d = 1n) {
  if (d === 0n) throw new Error("division by zero");
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(n < 0n ? -n : n, d < 0n ? -d : d) || 1n;
  return [(n / g) * (d < 0n ? -1n : 1n), (d < 0n ? -d : d) / g];
}
const addF = (a, b) => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const mulF = (a, b) => fraction(a[0] * b[0], a[1] * b[1]);
const constant = (x) => new Map([["", x]]);
function add(a, b, sign = 1n) {
  const out = new Map(a);
  for (const [key, value] of b)
    out.set(key, addF(out.get(key) || [0n, 1n], [value[0] * sign, value[1]]));
  return new Map([...out].filter(([, value]) => value[0] !== 0n));
}
function multiply(a, b) {
  const out = new Map();
  for (const [ka, va] of a)
    for (const [kb, vb] of b) {
      const key = (ka + kb).split("").sort().join("");
      if (key.length > 12 || out.size > 100)
        throw new Error("expression too complex");
      out.set(key, addF(out.get(key) || [0n, 1n], mulF(va, vb)));
    }
  return new Map([...out].filter(([, value]) => value[0] !== 0n));
}
function parse(value) {
  let input = normalize(value);
  if (!input || input.length > 200 || /[^0-9a-z+*/^().-]/.test(input))
    throw new Error("unsupported");
  const tokens = input.match(/\d+(?:\.\d+)?|[a-z]|[+*/^().-]/g);
  let i = 0,
    depth = 0;
  const one = constant([1n, 1n]);
  const binary = (a, b, op) => {
    if (op === "+")
      return {
        n: add(multiply(a.n, b.d), multiply(b.n, a.d)),
        d: multiply(a.d, b.d),
      };
    if (op === "-")
      return {
        n: add(multiply(a.n, b.d), multiply(b.n, a.d), -1n),
        d: multiply(a.d, b.d),
      };
    if (op === "*") return { n: multiply(a.n, b.n), d: multiply(a.d, b.d) };
    if (!b.n.size) throw new Error("division by zero");
    return { n: multiply(a.n, b.d), d: multiply(a.d, b.n) };
  };
  function atom() {
    if (++depth > 25) throw new Error("too deep");
    let result;
    const token = tokens[i++];
    if (token === "(") {
      result = sum();
      if (tokens[i++] !== ")") throw new Error("unbalanced");
    } else if (/^\d/.test(token || "")) {
      const digits = (token.split(".")[1] || "").length;
      result = {
        n: constant(
          fraction(BigInt(token.replace(".", "")), 10n ** BigInt(digits)),
        ),
        d: one,
      };
    } else if (/^[a-z]$/.test(token || ""))
      result = { n: new Map([[token, [1n, 1n]]]), d: one };
    else throw new Error("invalid token");
    depth--;
    if (tokens[i] === "^") {
      i++;
      const power = Number(tokens[i++]);
      if (!Number.isInteger(power) || power < 0 || power > 10)
        throw new Error("unsupported power");
      const base = result;
      result = { n: one, d: one };
      for (let count = 0; count < power; count++)
        result = binary(result, base, "*");
    }
    return result;
  }
  function unary() {
    if (tokens[i] === "+" || tokens[i] === "-") {
      const sign = tokens[i++];
      const value = unary();
      return sign === "-"
        ? { ...value, n: multiply(value.n, constant([-1n, 1n])) }
        : value;
    }
    return atom();
  }
  function product() {
    let value = unary();
    while (
      tokens[i] === "*" ||
      tokens[i] === "/" ||
      tokens[i] === "(" ||
      /^[a-z]$/.test(tokens[i] || "")
    ) {
      const explicit = tokens[i] === "*" || tokens[i] === "/";
      const op = explicit ? tokens[i++] : "*";
      value = binary(value, unary(), op);
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      value = binary(value, product(), op);
    }
    return value;
  }
  const result = sum();
  if (i !== tokens.length || !result.d.size) throw new Error("incomplete");
  return result;
}
function equivalent(a, b) {
  const left = normalize(a),
    right = normalize(b);
  if (!left || !right) return false;
  // Handle a single solved variable without accepting unrelated equations.
  const solved = (text) => text.match(/^([a-z])=(.+)$/);
  const la = solved(left),
    rb = solved(right);
  if (la || rb) {
    if (la && rb && la[1] !== rb[1]) return false;
    return equivalent(la ? la[2] : left, rb ? rb[2] : right);
  }
  try {
    const x = parse(left),
      y = parse(right);
    // Variable denominators require identical domains; do not silently cancel.
    if ([...x.d.keys(), ...y.d.keys()].some(Boolean)) {
      if (add(x.d, y.d, -1n).size) return false;
    }
    return add(multiply(x.n, y.d), multiply(y.n, x.d), -1n).size === 0;
  } catch {
    return left === right;
  }
}
module.exports = { equivalent, normalize };
