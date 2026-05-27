import { DatalogParseError } from "./types.js";
import type { AstAtom, AstRule, AstTerm } from "./types.js";

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenKind =
  | "string"   // "..."
  | "ident"    // lowercase identifier (predicate name)
  | "var"      // uppercase identifier (variable)
  | "wild"     // _
  | "lparen"   // (
  | "rparen"   // )
  | "comma"    // ,
  | "dot"      // .
  | "neck"     // :-
  | "bang"     // !
  | "neq"      // !=
  | "eof";

interface Token {
  kind: TokenKind;
  value: string;
  line: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;

  while (i < source.length) {
    // Newline tracking
    if (source[i] === "\n") {
      line++;
      i++;
      continue;
    }

    // Whitespace
    if (/\s/.test(source[i]!)) {
      i++;
      continue;
    }

    // Line comment
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    // String literal
    if (source[i] === '"') {
      let value = "";
      i++; // consume opening quote
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && source[i + 1] === '"') {
          value += '"';
          i += 2;
        } else {
          if (source[i] === "\n") line++;
          value += source[i];
          i++;
        }
      }
      if (i >= source.length) {
        throw new DatalogParseError("Unterminated string literal", line);
      }
      i++; // consume closing quote
      tokens.push({ kind: "string", value, line });
      continue;
    }

    // :- (neck)
    if (source[i] === ":" && source[i + 1] === "-") {
      tokens.push({ kind: "neck", value: ":-", line });
      i += 2;
      continue;
    }

    // != (neq)
    if (source[i] === "!" && source[i + 1] === "=") {
      tokens.push({ kind: "neq", value: "!=", line });
      i += 2;
      continue;
    }

    // ! (bang)
    if (source[i] === "!") {
      tokens.push({ kind: "bang", value: "!", line });
      i++;
      continue;
    }

    // Single-char tokens
    const singleMap: Record<string, TokenKind> = {
      "(": "lparen",
      ")": "rparen",
      ",": "comma",
      ".": "dot",
    };
    if (source[i]! in singleMap) {
      tokens.push({ kind: singleMap[source[i]!]!, value: source[i]!, line });
      i++;
      continue;
    }

    // Identifier or variable
    if (/[a-zA-Z_]/.test(source[i]!)) {
      let value = "";
      while (i < source.length && /[a-zA-Z0-9_-]/.test(source[i]!)) {
        value += source[i];
        i++;
      }
      if (value === "_") {
        tokens.push({ kind: "wild", value: "_", line });
      } else if (/^[A-Z]/.test(value)) {
        tokens.push({ kind: "var", value, line });
      } else {
        tokens.push({ kind: "ident", value, line });
      }
      continue;
    }

    throw new DatalogParseError(`Unexpected character: '${source[i]}'`, line);
  }

  tokens.push({ kind: "eof", value: "", line });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseProgram(source: string): AstRule[] {
  const tokens = tokenize(source);
  let pos = 0;

  function peek(): Token {
    return tokens[pos]!;
  }

  function consume(expected?: TokenKind): Token {
    const tok = tokens[pos]!;
    if (expected !== undefined && tok.kind !== expected) {
      throw new DatalogParseError(
        `Expected '${expected}' but got '${tok.kind}' ('${tok.value}')`,
        tok.line,
      );
    }
    pos++;
    return tok;
  }

  function parseTerm(): AstTerm {
    const tok = peek();
    if (tok.kind === "string") {
      consume("string");
      return { kind: "const", value: tok.value };
    }
    if (tok.kind === "var") {
      consume("var");
      return { kind: "var", name: tok.value };
    }
    if (tok.kind === "wild") {
      consume("wild");
      return { kind: "wild" };
    }
    throw new DatalogParseError(
      `Expected term (string, variable, or _) but got '${tok.kind}' ('${tok.value}')`,
      tok.line,
    );
  }

  function parseAtomWithPred(pred: string, predLine: number, negated: boolean): AstAtom {
    if (peek().kind !== "lparen") {
      throw new DatalogParseError(
        `Expected '(' after predicate '${pred}'`,
        predLine,
      );
    }
    consume("lparen");
    const terms: AstTerm[] = [];
    if (peek().kind !== "rparen") {
      terms.push(parseTerm());
      while (peek().kind === "comma") {
        consume("comma");
        terms.push(parseTerm());
      }
    }
    consume("rparen");
    return { predicate: pred, terms, negated };
  }

  function parseHeadAtom(): AstAtom {
    const tok = consume("ident");
    return parseAtomWithPred(tok.value, tok.line, false);
  }

  function parseBodyAtom(): AstAtom {
    const tok = peek();

    // Negated atom: !pred(...)
    if (tok.kind === "bang") {
      consume("bang");
      const identTok = consume("ident");
      return parseAtomWithPred(identTok.value, identTok.line, true);
    }

    // Infix comparison: Var != Var  (or Var != "const", etc.)
    if (tok.kind === "var" || tok.kind === "wild") {
      const term1 = parseTerm();
      const neqTok = peek();
      if (neqTok.kind !== "neq") {
        throw new DatalogParseError(
          `Expected '!=' after term in body position`,
          neqTok.line,
        );
      }
      consume("neq");
      const term2 = parseTerm();
      return { predicate: "!=", terms: [term1, term2], negated: false };
    }

    // Regular positive atom
    const identTok = consume("ident");
    return parseAtomWithPred(identTok.value, identTok.line, false);
  }

  function parseRule(): AstRule {
    const head = parseHeadAtom();

    if (peek().kind === "dot") {
      consume("dot");
      return { head, body: [] };
    }

    consume("neck");

    const body: AstAtom[] = [];
    body.push(parseBodyAtom());
    while (peek().kind === "comma") {
      consume("comma");
      body.push(parseBodyAtom());
    }
    consume("dot");

    return { head, body };
  }

  const rules: AstRule[] = [];
  while (peek().kind !== "eof") {
    rules.push(parseRule());
  }
  return rules;
}
