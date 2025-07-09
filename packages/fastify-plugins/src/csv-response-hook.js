const csvResponseHook = (filename) => async (req, reply) => {
  if (reply.statusCode < 400) {
    reply.header('Content-disposition', `attachment; filename=${filename}`);
    reply.header('Content-type', 'text/csv');
  }
};

module.exports = { csvResponseHook };
