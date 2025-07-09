const { initBasicAuthValidate } = require('../src/basic-auth');

describe('Basic Auth', () => {
  const username = 'USER';
  const password = 'PASS';

  it('Should complete if username and password match', async () => {
    const basciAuthValidate = initBasicAuthValidate(username, password);

    const result = await basciAuthValidate(username, password);

    expect(result).toEqual(undefined);
  });

  it('Should fail if username and password do not match', () => {
    const basciAuthValidate = initBasicAuthValidate(username, password);

    const exec = () =>
      basciAuthValidate(`${username}-DIFF`, `${password}-DIFF`);

    expect(exec).rejects.toThrowError('Wrong username or password');
  });
});
