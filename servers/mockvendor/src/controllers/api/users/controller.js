const { map, toLower } = require('lodash/fp');

const userController = async (fastify) => {
  fastify.post('/', async ({ body, repos }) =>
    repos.users.insert({ ...body, emails: map(toLower, body.emails) })
  );
  fastify.get('/', async ({ repos }) => repos.users.find({}));
  fastify.get('/:id', async ({ params: { id }, repos }) =>
    repos.users.findById(id)
  );
  fastify.delete('/:id', async ({ params: { id }, repos }) =>
    repos.users.del(id)
  );

  fastify.put('/:id', async ({ body, params: { id }, repos }) =>
    repos.users.update(id, body)
  );
};

module.exports = userController;
