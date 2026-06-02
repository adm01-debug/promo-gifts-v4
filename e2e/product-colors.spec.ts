/**
 * @deprecated BUG-5 FIX (2026-06-02): Este arquivo foi criado pelo Lovable
 * em edt-cf0c6e3f (16:18) e imediatamente invalidado pelas mudanças de
 * edt-5f18b8c3 (16:29) na mesma sessão de edição.
 *
 * PROBLEMA: Os seletores aqui nunca correspondem ao componente real:
 *
 *   Seletor no spec         | Realidade do componente
 *   ----------------------- | ----------------------------------
 *   [role="list"]           | Componente usa role="group"
 *   button[role="listitem"] | Buttons não têm role "listitem"
 *   aria-label /^Cor: /     | Componente usa "Opção de cor: "
 *
 * Os testes não falhavam — eles simplesmente não encontravam os elementos
 * e pulavam os asserts silenciosamente, criando falsa confiança no CI.
 *
 * SUBSTITUTO: e2e/product-colors-full.spec.ts (seletores corretos e atualizados).
 *
 * Este arquivo pode ser deletado com segurança após confirmar que
 * product-colors-full.spec.ts está passando em todos os módulos.
 */

// Arquivo intencionalmente vazio — todos os testes foram movidos para
// e2e/product-colors-full.spec.ts
