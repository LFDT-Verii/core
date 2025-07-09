/**
 * Created by Michael Avoyan on 04/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import VCLDidDocument from '../../../api/entities/VCLDidDocument';

export default interface ResolveDidDocumentRepository {
    resolveDidDocument(did: string): Promise<VCLDidDocument>;
}
