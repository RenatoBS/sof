import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';
import { getApiBaseUrl } from '@/src/api/client';
import { getToken } from '@/src/auth/tokenStorage';
import type { Appointment, WhatsappHandoff } from '@/src/api/types';

type Handlers = {
  onCreated?: (appointment: Appointment) => void;
  onUpdated?: (appointment: Appointment) => void;
  onDeleted?: (appointmentId: string) => void;
  onHandoffOpened?: (handoff: WhatsappHandoff) => void;
  onHandoffUpdated?: (handoff: WhatsappHandoff) => void;
  onHandoffResolved?: (handoff: WhatsappHandoff) => void;
};

export function useRealtime(handlers: Handlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource<string> | null = null;
    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      es = new EventSource<string>(`${getApiBaseUrl()}/api/events/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      es.addEventListener('message', (event) => {
        // heartbeat comments — ignore
        if (!event.data || event.data.startsWith(':')) return;
      });

      es.addEventListener('appointment:created' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onCreated?.(data.appointment);
      });

      es.addEventListener('appointment:updated' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onUpdated?.(data.appointment);
      });

      es.addEventListener('appointment:deleted' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onDeleted?.(data.appointmentId);
      });

      es.addEventListener('whatsapp-handoff:opened' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onHandoffOpened?.(data.handoff);
      });

      es.addEventListener('whatsapp-handoff:updated' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onHandoffUpdated?.(data.handoff);
      });

      es.addEventListener(
        'whatsapp-handoff:resolved' as 'message',
        (event) => {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          handlersRef.current.onHandoffResolved?.(data.handoff);
        },
      );
    })();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [enabled]);
}
