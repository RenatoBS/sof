import { envStripCopy, resolveAppEnv } from '../appEnv';

describe('resolveAppEnv', () => {
  const prevEnv = process.env.EXPO_PUBLIC_APP_ENV;
  const prevApi = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = prevEnv;
    if (prevApi === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevApi;
  });

  it('respeita EXPO_PUBLIC_APP_ENV explícito', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'qa';
    expect(resolveAppEnv()).toBe('qa');
    process.env.EXPO_PUBLIC_APP_ENV = 'local';
    expect(resolveAppEnv()).toBe('local');
    process.env.EXPO_PUBLIC_APP_ENV = 'prod';
    expect(resolveAppEnv()).toBe('production');
  });

  it('infere pela API URL quando sem explicit', () => {
    delete process.env.EXPO_PUBLIC_APP_ENV;
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3001';
    expect(resolveAppEnv()).toBe('local');
    process.env.EXPO_PUBLIC_API_URL = 'https://sof-solutions-api-qa.herokuapp.com';
    expect(resolveAppEnv()).toBe('qa');
  });
});

describe('envStripCopy', () => {
  it('só mostra faixa fora de produção', () => {
    expect(envStripCopy('production')).toBeNull();
    expect(envStripCopy('qa')).toEqual({
      label: 'Ambiente de teste',
      detail: 'QA',
    });
    expect(envStripCopy('local')?.label).toBe('Ambiente local');
  });
});
