import VCLExchange from '../../src/api/entities/VCLExchange';
import VCLSubmissionResult from '../../src/api/entities/VCLSubmissionResult';
import VCLToken from '../../src/api/entities/VCLToken';

describe('VCLSubmissionResult Tests', () => {
    let subject: VCLSubmissionResult;

    beforeEach(() => {
        subject = new VCLSubmissionResult(
            new VCLToken('token123'),
            new VCLExchange('id123', 'type123', true, true),
            'jti123',
            'submissionId123'
        );
    });

    test('testProps', () => {
        expect(subject.sessionToken.value).toEqual('token123');
        expect(subject.exchange.id).toEqual('id123');
        expect(subject.exchange.type).toEqual('type123');
        expect(subject.exchange.exchangeComplete).toBeTruthy();
        expect(subject.exchange.disclosureComplete).toBeTruthy();
        expect(subject.jti).toEqual('jti123');
        expect(subject.submissionId).toEqual('submissionId123');
    });
});
