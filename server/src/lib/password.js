const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function hash(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

function verify(plainText, hashed) {
  return bcrypt.compare(plainText, hashed);
}

// Gera uma senha temporária legível (ex.: "K7RT-93PL") para entregar ao cliente após o pagamento.
function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 para evitar confusão
  const block = () => Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return `${block()}-${block()}`;
}

module.exports = { hash, verify, generateTempPassword };
