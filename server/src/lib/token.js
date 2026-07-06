const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE_NAME = 'soft_session';
const EXPIRES_IN = '30d';

function sign(accountId) {
  return jwt.sign({ sub: accountId }, config.jwtSecret, { expiresIn: EXPIRES_IN });
}

function verify(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return payload.sub;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

module.exports = { sign, verify, COOKIE_NAME, cookieOptions };
