type BotPauseFlags = {
  botPausedPermanent?: boolean | null;
  botPausedUntil?: Date | string | null;
};

/** Bot silencioso se permanente ou se `botPausedUntil` ainda no futuro. */
export function isBotPaused(entity: BotPauseFlags | null | undefined): boolean {
  if (!entity) return false;
  if (entity.botPausedPermanent) return true;
  if (!entity.botPausedUntil) return false;
  const until =
    entity.botPausedUntil instanceof Date
      ? entity.botPausedUntil
      : new Date(entity.botPausedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > Date.now();
}

/** @deprecated Preferir `isBotPaused` — mesmo comportamento. */
export function isClientBotPaused(
  client: BotPauseFlags | null | undefined,
): boolean {
  return isBotPaused(client);
}

export function isAccountBotPaused(
  account: BotPauseFlags | null | undefined,
): boolean {
  return isBotPaused(account);
}
