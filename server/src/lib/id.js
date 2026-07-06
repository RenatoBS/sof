const crypto = require('crypto');

function id(prefix) {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${raw}` : raw;
}

module.exports = { id };
