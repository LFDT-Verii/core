/* eslint-disable */
import { VCLKeyService } from "../../../../src";
import VCLDidJwkDescriptor from "../../../../src/api/entities/VCLDidJwkDescriptor";
import VCLDidJwk from "../../../../src/api/entities/VCLDidJwk";
import { DidJwkMocks } from "../valid/DidJwkMocks";

export class KeyServiceMock implements VCLKeyService {
    async generateDidJwk(didJwkDescriptor: VCLDidJwkDescriptor): Promise<VCLDidJwk> {
        return DidJwkMocks.DidJwk
    }
}