/* eslint-disable max-len */
import { VCLJwt, VCLToken } from '../../../src';

export class CommonMocks {
    static readonly UUID1: string = '6E6B7489-13C8-45E8-A24D-0BC309B484D1';

    static readonly UUID2: string = '6E6B7489-13C8-45E8-A24D-0BC309B484D2';

    static readonly UUID3: string = '6E6B7489-13C8-45E8-A24D-0BC309B484D3';

    static readonly UUID4: string = '6E6B7489-13C8-45E8-A24D-0BC309B484D4';

    static readonly UUID5: string = '6E6B7489-13C8-45E8-A24D-0BC309B484D5';

    static readonly DID1: string =
        'did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvh1';

    static readonly DID2: string =
        'did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvh2';

    static readonly DID3: string =
        'did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvh3';

    static readonly DID4: string =
        'did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvh4';

    static readonly DID5: string =
        'did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvh5';

    static readonly JWT: VCLJwt = VCLJwt.fromEncodedJwt(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    );

    static readonly Token = new VCLToken(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    );
}
