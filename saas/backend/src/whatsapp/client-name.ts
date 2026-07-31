/**
 * Captura do nome do cliente no 1º contato do bot WhatsApp.
 *
 * A Sof pede nome e sobrenome. Se vier só o primeiro nome, ela pede o
 * sobrenome **uma única vez** — qualquer resposta depois disso segue o fluxo,
 * nunca volta a perguntar (evita loop com quem só manda o primeiro nome).
 */

/** Respostas comuns que chegam no lugar do nome — não viram cadastro. */
const NOT_A_NAME =
  /^(oi|ola|opa|eae|e ai|alo|hey|hi|hello|bom dia|boa tarde|boa noite|boa|tudo bem|tudo bom|blz|beleza|obrigado|obrigada|sim|nao|ok|okay|menu|reset|cancelar|agendar|marcar|quero|preciso|ajuda|help|teste)$/;

const CONNECTIVES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** Sem acento, caixa nem pontuação — para comparar textos. */
function normalizeNameText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove saudação e rodeios antes do nome ("oi, meu nome é Ana Silva"). */
function stripPreamble(text: string) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(ol[aá]|oi|opa|bom dia|boa tarde|boa noite)[,!.\s]+/i, '')
    .replace(
      /^(meu\s+(nome|sobrenome)\s+(é|e|eh)\s+|me\s+chamo\s+|sou\s+(o|a)\s+|nome:\s*|sobrenome:\s*|[ée]h?\s+)/i,
      '',
    )
    .replace(/[.,;!?]+$/, '')
    .trim();
}

/** Palavra que pode ser parte de um nome (só letras, 2+ caracteres). */
function isNameWord(word: string) {
  return (
    /^[\p{L}][\p{L}'’-]*$/u.test(word) &&
    word.replace(/[^\p{L}]/gu, '').length >= 2
  );
}

function looksLikeName(text: string) {
  return !NOT_A_NAME.test(normalizeNameText(text));
}

export function titleCaseName(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word, idx) => {
      const lower = word.toLocaleLowerCase('pt-BR');
      if (idx > 0 && CONNECTIVES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
    })
    .join(' ');
}

/** Nome e sobrenome: 2 a 6 palavras, todas plausíveis como nome. */
export function parseFullName(text: string): string | null {
  const name = stripPreamble(text);
  if (name.length < 5) return null;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return null;
  if (!parts.every(isNameWord)) return null;
  if (!looksLikeName(name)) return null;
  return titleCaseName(name);
}

/** Só o primeiro nome ("Pedro") — a Sof pede o sobrenome em seguida. */
export function parseFirstName(text: string): string | null {
  const name = stripPreamble(text);
  const parts = name.split(' ').filter(Boolean);
  if (parts.length !== 1) return null;
  if (!isNameWord(parts[0])) return null;
  if (!looksLikeName(name)) return null;
  return titleCaseName(name);
}

/**
 * Resposta ao pedido de sobrenome. Nunca falha: se vier o mesmo nome de novo,
 * ou qualquer coisa que não pareça sobrenome, fica só o primeiro nome.
 */
export function mergeLastName(firstName: string, text: string): string {
  const answer = stripPreamble(text);
  const parts = answer.split(' ').filter(Boolean);
  if (!parts.length || parts.length > 3) return firstName;
  if (!parts.every(isNameWord)) return firstName;
  if (!looksLikeName(answer)) return firstName;

  const first = normalizeNameText(firstName);
  const given = normalizeNameText(answer);
  if (given === first) return firstName;
  // Repetiu o nome junto do sobrenome ("Pedro Silva").
  if (given.startsWith(`${first} `)) return titleCaseName(answer);
  return titleCaseName(`${firstName} ${answer}`);
}
