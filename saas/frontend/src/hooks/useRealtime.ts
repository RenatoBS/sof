import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';
import { getApiBaseUrl } from '@/src/api/client';
import { getEmployeeToken, getToken } from '@/src/auth/tokenStorage';
import type {
  Appointment,
  Client,
  WhatsappHandoff,
  WhatsappMessage,
} from '@/src/api/types';

type Handlers = {
  onCreated?: (appointment: Appointment) => void;
  onUpdated?: (appointment: Appointment) => void;
  onDeleted?: (appointmentId: string) => void;
  onHandoffOpened?: (handoff: WhatsappHandoff) => void;
  onHandoffUpdated?: (handoff: WhatsappHandoff) => void;
  onHandoffResolved?: (handoff: WhatsappHandoff) => void;
  onHandoffMessage?: (handoffId: string, message: WhatsappMessage) => void;
  onClientUpdated?: (client: Client) => void;
};

type AuthMode = 'account' | 'employee';

export function useRealtime(
  handlers: Handlers,
  enabled = true,
  auth: AuthMode = 'account',
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource<string> | null = null;
    let cancelled = false;

    (async () => {
      const token =
        auth === 'employee' ? await getEmployeeToken() : await getToken();
      if (!token || cancelled) return;

      const path =
        auth === 'employee'
          ? '/api/employee/events/stream'
          : '/api/events/stream';

      es = new EventSource<string>(`${getApiBaseUrl()}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      es.addEventListener('message', (event) => {
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

      es.addEventListener('whatsapp-handoff:message' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onHandoffMessage?.(data.handoffId, data.message);
      });

      es.addEventListener('client:updated' as 'message', (event) => {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        handlersRef.current.onClientUpdated?.(data.client);
      });
    })();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [enabled, auth]);
}
