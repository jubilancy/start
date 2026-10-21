// Safe arithmetic evaluator (no eval): + - * / ^ % ( ), unary minus, constants pi/e, functions sqrt sin cos tan asin acos atan log ln abs round floor ceil exp.
const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, log: Math.log10, ln: Math.log, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp };
const CONST = { pi: Math.PI, e: Math.E };
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };

function tokenize(src) {
  const out = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|([a-z]+)|(.))/gi;
  let m, prev = null;
  while ((m = re.exec(src)) && m[0] !== '') {
    if (m[1] !== undefined) out.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) {
      const id = m[2].toLowerCase();
      if (id in CONST) out.push({ t: 'num', v: CONST[id] });
      else if (id in FN) out.push({ t: 'fn', v: id });
      else throw new Error(`Unknown name "${m[2]}"`);
    } else {
      const c = m[3];
      if ('+-*/^%()'.includes(c)) {
        if (c === '-' && (!prev || (prev.t === 'op' && prev.v !== ')') || prev.t === 'fn')) out.push({ t: 'num', v: 0 }), out.push({ t: 'op', v: 'u-' });
        else out.push({ t: 'op', v: c });
      } else if (c === '×') out.push({ t: 'op', v: '*' });
      else if (c === '÷') out.push({ t: 'op', v: '/' });
      else throw new Error(`Unexpected "${c}"`);
    }
    prev = out[out.length - 1];
  }
  return out;
}

export function evaluate(src) {
  const toks = tokenize(src);
  if (!toks.length) throw new Error('Empty');
  const outQ = [], ops = [];
  const apply = op => {
    if (op === 'u-') { const b = outQ.pop(), a = outQ.pop(); outQ.push(a - b); return; }
    const b = outQ.pop(), a = outQ.pop();
    if (a === undefined || b === undefined) throw new Error('Malformed expression');
    outQ.push(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : op === '%' ? a % b : a ** b);
  };
  for (const k of toks) {
    if (k.t === 'num') outQ.push(k.v);
    else if (k.t === 'fn') ops.push(k.v);
    else if (k.v === '(') ops.push('(');
    else if (k.v === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') apply(ops.pop());
      if (!ops.length) throw new Error('Unbalanced )');
      ops.pop();
      if (ops.length && ops[ops.length - 1] in FN) outQ.push(FN[ops.pop()](outQ.pop()));
    } else {
      const p = k.v === 'u-' ? 3 : PREC[k.v];
      while (k.v !== 'u-' && ops.length) {
        const top = ops[ops.length - 1];
        if (top === '(' || top in FN) break;
        const tp = top === 'u-' ? 3 : PREC[top];
        if (tp > p || (tp === p && k.v !== '^')) apply(ops.pop()); else break;
      }
      ops.push(k.v);
    }
  }
  while (ops.length) { const o = ops.pop(); if (o === '(') throw new Error('Unbalanced ('); apply(o); }
  if (outQ.length !== 1 || !Number.isFinite(outQ[0])) throw new Error('Not a number');
  return outQ[0];
}
