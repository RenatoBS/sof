import { mergeLastName, parseFirstName, parseFullName } from './client-name';

describe('client-name', () => {
  it('aceita nome e sobrenome, normalizando a caixa', () => {
    expect(parseFullName('Ana Silva')).toBe('Ana Silva');
    expect(parseFullName('  ana   silva ')).toBe('Ana Silva');
    expect(parseFullName('ANA PAULA DE SOUZA')).toBe('Ana Paula de Souza');
  });

  it('ignora saudação e rodeio antes do nome', () => {
    expect(parseFullName('oi, meu nome é Ana Silva')).toBe('Ana Silva');
    expect(parseFullName('me chamo Ana Silva')).toBe('Ana Silva');
    expect(parseFirstName('meu nome é Pedro')).toBe('Pedro');
    expect(parseFirstName('Boa tarde, sou o Pedro')).toBe('Pedro');
  });

  it('não aceita saudação nem comando como nome', () => {
    expect(parseFullName('bom dia')).toBeNull();
    expect(parseFirstName('oi')).toBeNull();
    expect(parseFirstName('quero')).toBeNull();
    expect(parseFirstName('123')).toBeNull();
  });

  it('separa primeiro nome de nome completo', () => {
    expect(parseFullName('Pedro')).toBeNull();
    expect(parseFirstName('Pedro')).toBe('Pedro');
    expect(parseFirstName('Pedro Alves')).toBeNull();
  });

  it('junta o sobrenome informado depois', () => {
    expect(mergeLastName('Pedro', 'Alves')).toBe('Pedro Alves');
    expect(mergeLastName('Pedro', 'meu sobrenome é alves')).toBe('Pedro Alves');
    expect(mergeLastName('Pedro', 'Alves de Souza')).toBe(
      'Pedro Alves de Souza',
    );
  });

  it('não duplica quando o cliente repete o nome junto do sobrenome', () => {
    expect(mergeLastName('Pedro', 'Pedro Alves')).toBe('Pedro Alves');
  });

  it('segue só com o primeiro nome se a resposta não for sobrenome', () => {
    expect(mergeLastName('Pedro', 'Pedro')).toBe('Pedro');
    expect(mergeLastName('Pedro', 'pedro')).toBe('Pedro');
    expect(mergeLastName('Pedro', 'oi')).toBe('Pedro');
    expect(mergeLastName('Pedro', '')).toBe('Pedro');
    expect(mergeLastName('Pedro', 'quero marcar um corte amanhã')).toBe(
      'Pedro',
    );
  });
});
