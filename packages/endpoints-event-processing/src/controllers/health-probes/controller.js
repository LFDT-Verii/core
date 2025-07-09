const { flow, filter, first } = require('lodash/fp');

const { subSeconds } = require('date-fns');
const {
  initGetSignerMetrics,
  initGetBlockNumber,
  initGetBlock,
} = require('@verii/blockchain-functions');
const {
  toBigNumber,
  fromBigNumber,
  subtractBigNumbers,
} = require('@verii/math');
const { HealthStates } = require('../../entities');

const blockGraceInterval = 6;
const blocksDeltaMultiplier = 3;

const signerMetricsController = async (fastify) => {
  fastify.get(
    '/consensus',
    {
      onRequest: fastify.basicAuth,
      schema: fastify.autoSchema({
        response: {
          200: {
            status: { type: 'string' },
          },
        },
      }),
    },
    async (req) => {
      const getBlockNumber = await initGetBlockNumber({
        rpcUrl: req.config.rpcUrl,
        authenticate: req.vnfBlockchainAuthenticate,
      });
      const getBlock = await initGetBlock({
        rpcUrl: req.config.rpcUrl,
        authenticate: req.vnfBlockchainAuthenticate,
      });

      const blockNumber = await getBlockNumber();
      const block = await getBlock(blockNumber);

      req.log.info({
        blockNumber,
        block,
      });

      const lastBLockTime = new Date(block.timestamp * 1000);
      const status =
        lastBLockTime < subSeconds(new Date(), blockGraceInterval)
          ? { status: HealthStates.Down }
          : { status: HealthStates.Up };

      return status;
    }
  );

  fastify.get(
    '/node/:address',
    {
      onRequest: fastify.basicAuth,
      schema: fastify.autoSchema({
        response: {
          200: {
            status: { type: 'string' },
          },
        },
      }),
    },
    async (req) => {
      const { address } = req.params;
      const getSignerMetrics = await initGetSignerMetrics({
        rpcUrl: req.config.rpcUrl,
        authenticate: req.vnfBlockchainAuthenticate,
      });
      const getBlockNumber = await initGetBlockNumber({
        rpcUrl: req.config.rpcUrl,
        authenticate: req.vnfBlockchainAuthenticate,
      });

      const metrics = await getSignerMetrics();
      const nodeMetrics = flow(
        filter((metric) => metric.address === address),
        first
      )(metrics);
      const nodesCount = metrics.length;
      const blockNumber = await getBlockNumber();

      req.log.info({
        nodeMetrics,
        blockNumber,
      });

      const status =
        fromBigNumber(
          subtractBigNumbers(
            toBigNumber(blockNumber),
            toBigNumber(nodeMetrics.lastProposedBlockNumber, 16)
          )
        ) >
        nodesCount * blocksDeltaMultiplier
          ? { status: HealthStates.Down }
          : { status: HealthStates.Up };

      req.log.info({
        address,
        status,
      });

      return status;
    }
  );
};

module.exports = signerMetricsController;
