jest.mock('@/src/auth/tokenStorage', () => ({
  getToken: jest.fn(),
  getEmployeeToken: jest.fn(),
}));

import { getEmployeeToken, getToken } from '@/src/auth/tokenStorage';
import { ApiError, api } from '../client';

const getTokenMock = getToken as jest.MockedFunction<typeof getToken>;
const getEmployeeTokenMock = getEmployeeToken as jest.MockedFunction<
  typeof getEmployeeToken
>;

describe('ApiError', () => {
  it('carrega status e nome', () => {
    const err = new ApiError('falhou', 403);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('falhou');
    expect(err.status).toBe(403);
  });
});

describe('api()', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    getTokenMock.mockReset();
    getEmployeeTokenMock.mockReset();
    // @ts-expect-error test double
    global.fetch = fetchMock;
  });

  it('envia Bearer da conta por padrão', async () => {
    getTokenMock.mockResolvedValue('acc-token');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await expect(api('/health')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/health$/),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer acc-token',
        }),
        credentials: 'include',
      }),
    );
  });

  it('usa token do profissional quando auth=employee', async () => {
    getEmployeeTokenMock.mockResolvedValue('emp-token');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ employee: { id: 'e1' } }),
    });

    await api('/employee-auth/me', { auth: 'employee' });
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer emp-token',
    );
  });

  it('omite Authorization quando auth=false', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: 'a@b.co', password: 'x' },
    });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('lança ApiError com mensagem do backend', async () => {
    getTokenMock.mockResolvedValue('t');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Senha incorreta.' }),
    });

    await expect(api('/auth/me')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Senha incorreta.',
      status: 401,
    });
  });
});
