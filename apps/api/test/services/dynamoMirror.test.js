const zlib = require('zlib');
const { decodeCompressedBody, convertItem } = require('../../src/migration/dynamoMirror');

const html = '<html><body><h1>Vue en ligne</h1><p>Bonjour</p></body></html>';
const deflate = zlib.deflateSync(Buffer.from(html, 'utf8'));
const base64Text = deflate.toString('base64'); // ce que la v1 écrivait (DynamoDB B et S3)
const inflate = (buffer) => zlib.inflateSync(buffer).toString('utf8');

describe('decodeCompressedBody', () => {
  test('attribut B tel que renvoyé par le CLI (base64 du texte base64 stocké par la v1)', () => {
    const cliValue = Buffer.from(base64Text, 'utf8').toString('base64');
    expect(inflate(decodeCompressedBody({ B: cliValue }))).toBe(html);
  });

  test('attribut B contenant directement le deflate (base64 du binaire)', () => {
    expect(inflate(decodeCompressedBody({ B: deflate.toString('base64') }))).toBe(html);
  });

  test('contenu S3 : texte base64 du deflate (Buffer lu sur disque ou chaîne)', () => {
    expect(inflate(decodeCompressedBody(Buffer.from(base64Text, 'utf8')))).toBe(html);
    expect(inflate(decodeCompressedBody(base64Text + '\n'))).toBe(html);
  });

  test('attribut S et deflate brut', () => {
    expect(inflate(decodeCompressedBody({ S: base64Text }))).toBe(html);
    expect(decodeCompressedBody(deflate)).toBe(deflate);
  });

  test('valeurs vides ou invalides → null', () => {
    expect(decodeCompressedBody(null)).toBeNull();
    expect(decodeCompressedBody(undefined)).toBeNull();
    expect(decodeCompressedBody({})).toBeNull();
    expect(decodeCompressedBody({ B: '' })).toBeNull();
    expect(decodeCompressedBody('pas du tout du base64 !!')).toBeNull();
    expect(decodeCompressedBody(Buffer.from('aGVsbG8=', 'utf8'))).toBeNull(); // base64 valide mais pas un flux zlib
  });
});

describe('convertItem', () => {
  const item = {
    mirrorId: { S: '0000009C-F9AE-4731-8D20-E282DAA1C5AE' },
    messageId: { S: '<msg-1@mta.example>' },
    ResourceUid: { S: 'clubdesjeux' },
    To: { S: 'contact@example.com' },
    Subject: { S: 'Bonjour' },
    Source: { S: 'Club <no-reply@example.com>' },
    CompressedBody: { B: Buffer.from(base64Text, 'utf8').toString('base64') },
    ExpDate: { N: '1800000000' }
  };

  test('convertit les attributs et le corps', () => {
    const converted = convertItem(item);
    expect(converted.error).toBeUndefined();
    expect(converted.resourceUid).toBe('clubdesjeux');
    expect(converted.hasInlineBody).toBe(true);
    expect(converted.row).toMatchObject({
      mirrorId: '0000009c-f9ae-4731-8d20-e282daa1c5ae',
      messageId: '<msg-1@mta.example>',
      to: 'contact@example.com',
      subject: 'Bonjour',
      source: 'Club <no-reply@example.com>'
    });
    expect(converted.row.expDate.toISOString()).toBe(new Date(1800000000 * 1000).toISOString());
    expect(inflate(converted.row.compressedBody)).toBe(html);
  });

  test('item sans corps (stocké dans S3 ou non archivé) et sans ExpDate', () => {
    const { CompressedBody, ExpDate, ...rest } = item;
    const before = Date.now();
    const converted = convertItem(rest);
    expect(converted.hasInlineBody).toBe(false);
    expect(converted.row.compressedBody).toBeNull();
    expect(converted.row.expDate.getTime()).toBeGreaterThanOrEqual(before + 29 * 24 * 3600 * 1000);
  });

  test('mirrorId invalide → erreur', () => {
    expect(convertItem({ mirrorId: { S: 'nope' } }).error).toMatch(/mirrorId invalide/);
    expect(convertItem({}).error).toMatch(/mirrorId invalide/);
  });
});
