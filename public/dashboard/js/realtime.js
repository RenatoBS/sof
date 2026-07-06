// Conecta ao canal de eventos do servidor (SSE) para refletir na hora os agendamentos
// que o bot do WhatsApp confirma, mesmo com o painel já aberto.
export function connectRealtime(handlers) {
  const source = new EventSource('/api/events/stream');

  source.addEventListener('appointment:created', (e) => {
    const data = JSON.parse(e.data);
    handlers.onCreated?.(data.appointment);
  });
  source.addEventListener('appointment:updated', (e) => {
    const data = JSON.parse(e.data);
    handlers.onUpdated?.(data.appointment);
  });
  source.addEventListener('appointment:deleted', (e) => {
    const data = JSON.parse(e.data);
    handlers.onDeleted?.(data.appointmentId);
  });
  source.onerror = () => {
    // O EventSource já tenta reconectar sozinho; nada a fazer aqui.
  };

  return source;
}
