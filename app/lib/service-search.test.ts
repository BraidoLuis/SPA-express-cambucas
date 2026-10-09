import { describe, expect, it } from "vitest";
import { matchesServiceSearch } from "./service-search";

describe("pesquisa local por nome do serviço", () => {
  it.each([
    ["Drenagem Linfática", "linfatica", true],
    ["Drenagem Linfática", "LINFÁTICA", true],
    ["Drenagem Linfática", "  LiNfAtIcA  ", true],
    ["Drenagem Linfática", "nagem lin", true],
    ["Depilação Facial", "depilacao", true],
    ["Depilacao Facial", "DEPILAÇÃO", true],
    ["Drenagem Linfa\u0301tica", "linfatica", true],
    ["Limpeza de Pele", "pele", true],
    ["Massagem Relaxante", "", true],
    ["Massagem Relaxante", "   ", true],
    ["Massagem Relaxante", "linfatica", false],
    ["Massagem Relaxante", "relaxinte", false],
    ["Limpeza de Pele", "limpeza  de", false],
  ])("%s com %s: %s", (name, query, expected) => {
    expect(matchesServiceSearch(name, query)).toBe(expected);
  });
});
