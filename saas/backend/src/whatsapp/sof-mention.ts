/**
 * Cliente chamando pela Sof durante a pausa automática do bot.
 *
 * Serve de "palavra mágica" para trazer o bot de volta antes de a pausa de 1h
 * vencer. Só a menção à marca conta — não vale qualquer mensagem, senão a
 * primeira coisa que o cliente escrevesse já anularia a pausa.
 */

/** Sem acento e sem pontuação, para "Sof?" e "sof," casarem igual. */
function normalize(text: string) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Palavra isolada `sof` no texto. A normalização tira o acento antes, então
 * "sofá" vira "sofa" e não casa — assim como "sofrer", "software".
 */
export function mentionsSof(text: string): boolean {
  return /\bsof\b/.test(normalize(text));
}
