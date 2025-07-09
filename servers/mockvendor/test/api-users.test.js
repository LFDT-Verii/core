const { mongoDb } = require('@spencejs/spence-mongo-repos');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const { map, omit, toUpper } = require('lodash/fp');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const initUserFactory = require('./factories/users.factory');

describe('Users API Test Suite', () => {
  let fastify;
  let newUser;
  let persistUser;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ newUser, persistUser } = initUserFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('users').deleteMany({});
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should be able to create a user', async () => {
    const user = await newUser();
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/users',
      payload: user,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      ...user,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      _id: expect.stringMatching(OBJECT_ID_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });
  });
  it('should be able to create a user with an uppercase email', async () => {
    const user = await newUser();
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/users',
      payload: { ...user, emails: map(toUpper, user.emails) },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      ...user,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      _id: expect.stringMatching(OBJECT_ID_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });
  });
  it('should be able to create a user with a token', async () => {
    const user = await newUser({ token: 'foo' });
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/users',
      payload: { ...user, emails: map(toUpper, user.emails) },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      ...user,
      token: 'foo',
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      _id: expect.stringMatching(OBJECT_ID_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });
  });
  it('should be able to get a user', async () => {
    const user = await persistUser({ token: 'foo' });
    const response = await fastify.injectJson({
      method: 'GET',
      url: `/api/users/${user._id}`,
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      ...user,
      token: 'foo',
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      _id: expect.stringMatching(OBJECT_ID_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });
  });
  it('should be able to get all users', async () => {
    const [user1, user2] = await Promise.all([persistUser(), persistUser()]);
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/users',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual(
      expect.arrayContaining([
        {
          ...user1,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          _id: expect.stringMatching(OBJECT_ID_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
        {
          ...user2,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          _id: expect.stringMatching(OBJECT_ID_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
      ])
    );
  });
  it('should be able to update a user', async () => {
    const [user1] = await Promise.all([persistUser(), persistUser()]);
    const response = await fastify.injectJson({
      method: 'PUT',
      url: `/api/users/${user1._id}`,
      payload: {
        ...omit(['id', '_id', 'createdAt', 'updatedAt'], user1),
        firstName: 'Mary',
        token: 'foo',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      ...user1,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      token: 'foo',
      firstName: 'Mary',
    });
  });
  it('should be able to delete a user', async () => {
    const [, user2] = await Promise.all([persistUser(), persistUser()]);
    const getResponsePre = await fastify.injectJson({
      method: 'GET',
      url: '/api/users',
    });
    expect(getResponsePre.json).toEqual(
      expect.arrayContaining([
        { ...user2, id: expect.stringMatching(OBJECT_ID_FORMAT) },
      ])
    );
    const response = await fastify.injectJson({
      method: 'DELETE',
      url: `/api/users/${user2._id}`,
    });
    expect(response.statusCode).toEqual(200);
    const getResponsePost = await fastify.injectJson({
      method: 'GET',
      url: '/api/users',
    });
    expect(getResponsePost.json).not.toEqual(
      expect.arrayContaining([
        { ...user2, id: expect.stringMatching(OBJECT_ID_FORMAT) },
      ])
    );
  });
});
