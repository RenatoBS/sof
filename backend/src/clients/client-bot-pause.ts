export type ClientBotPauseFields = {
  botPausedPermanent?: boolean | null;
  botPausedUntil?: Date | string | null;
};

/** Bot silencioso se permanente ou se `botPausedUntil` ainda no futuro. */
export function isClientBotPaused(client: ClientBotPauseFields | null | undefined) {
  if (!client) return false;
  if (client.botPausedPermanent) return true;
  if (!client.botPausedUntil) return false;
  const until =
    client.botPausedUntil instanceof Date
      ? client.botPausedUntil
      : new Date(client.botPausedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > Date.now();
}
