function publicAccount(account) {
  if (!account) return null;
  const { passwordHash, ...safe } = account;
  return safe;
}

module.exports = { publicAccount };
