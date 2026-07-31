import { mentionsSof } from './sof-mention';

describe('mentionsSof', () => {
  it('reconhece a chamada pela marca', () => {
    expect(mentionsSof('Sof')).toBe(true);
    expect(mentionsSof('sof?')).toBe(true);
    expect(mentionsSof('oi Sof, quero marcar')).toBe(true);
    expect(mentionsSof('SOF')).toBe(true);
  });

  it('não casa com palavra que apenas começa com sof', () => {
    expect(mentionsSof('vou trocar o sofá')).toBe(false);
    expect(mentionsSof('sofrendo com a fila')).toBe(false);
    expect(mentionsSof('software')).toBe(false);
  });

  it('ignora texto sem a marca', () => {
    expect(mentionsSof('oi')).toBe(false);
    expect(mentionsSof('')).toBe(false);
  });
});
