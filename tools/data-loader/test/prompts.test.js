const { after, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockPrompt = mock.fn();
mock.module('inquirer', {
  namedExports: {
    default: {
      prompt: mockPrompt,
    },
  },
});

const {
  askDisclosureList,
  askDisclosureType,
} = require('../src/batch-issuing/prompts');

describe('batch issuing prompts', () => {
  beforeEach(() => {
    mockPrompt.mock.resetCalls();
  });

  after(() => {
    mock.reset();
  });

  it('should resolve askDisclosureType using inquirer prompt', async () => {
    mockPrompt.mock.mockImplementationOnce(async () => ({
      disclosureType: 'existing',
    }));

    await expect(askDisclosureType()).resolves.toEqual('existing');
    expect(mockPrompt.mock.callCount()).toEqual(1);
  });

  it('should use select questions for disclosure prompts', async () => {
    mockPrompt.mock.mockImplementationOnce(async () => ({
      disclosure: 'disclosure-1',
    }));

    await askDisclosureList([
      {
        id: 'disclosure-1',
        purpose: 'Employment',
        createdAt: '2026-03-18T01:02:03.000Z',
      },
    ]);

    const [questions] = mockPrompt.mock.calls[0].arguments;
    expect(questions).toEqual([
      expect.objectContaining({
        type: 'select',
        name: 'disclosure',
        message: 'Please select a disclosure',
        choices: [
          expect.objectContaining({
            value: 'disclosure-1',
          }),
        ],
      }),
    ]);
  });
});
