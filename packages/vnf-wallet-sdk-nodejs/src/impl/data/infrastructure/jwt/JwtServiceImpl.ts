/* eslint-disable */
import { jwtVerify, base64url, JWK, exportJWK, SignJWT, importJWK } from "jose";
import util from "util";
import VCLDidJwk from "../../../../api/entities/VCLDidJwk";
import VCLDidJwkDescriptor from "../../../../api/entities/VCLDidJwkDescriptor";
import VCLJwt, { SignedJWT } from "../../../../api/entities/VCLJwt";
import VCLJwtDescriptor from "../../../../api/entities/VCLJwtDescriptor";
// import JwtService from "../../../domain/infrastructure/jwt/JwtService";
import crypto from "crypto";
import canonicalize from "canonicalize";
import VCLPublicJwk from "../../../../api/entities/VCLPublicJwk";
/* 
export default class JwtServiceImpl implements JwtService {
    parse(jwt: string): Nullish<SignedJWT> {
        return SignedJWT.parse(jwt);
    }
    encode(str: string): string {
        return base64url.encode(str);
    }
    async verify(jwt: VCLJwt, jwk: string): Promise<boolean> {
        let parsedJwk = JSON.parse(jwk);
        let importedJwk = await importJWK(parsedJwk, "ECDSA");
        try {
            await jwtVerify(jwt.encodedJwt!, importedJwk);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    async sign(jwtDescriptor: VCLJwtDescriptor): Promise<Nullish<SignedJWT>> {
        const jwk = this.generateJwkSECP256K1(jwtDescriptor.kid);
        let publicJwk = await jwk.toPublicJWK();

        const header = {
            alg: "ES256K",
            jwk: publicJwk,
            typ: "JWT",
        };

        let signedJwtRes = new SignJWT(jwtDescriptor.payload)
            .setProtectedHeader(header)
            .setAudience(jwtDescriptor.iss)
            .setIssuer(jwtDescriptor.iss)
            .setJti(jwtDescriptor.jti)
            .setIssuedAt(Math.floor(Date.now() / 1000))
            .setNotBefore(Math.floor(Date.now() / 1000))
            .setExpirationTime("7d")
            .setSubject("".randomString(10));

        let result: string = "";

        try {
            result = await signedJwtRes.sign(jwk.privateKey);
        } catch (error) {
            console.log(error);
        }

        return SignedJWT.parse(result);
    }

    async generateDidJwk(
        didJwkDescriptor: Nullish<VCLDidJwkDescriptor>
    ): Promise<VCLDidJwk> {
        let publicJwk = await this.generatePublicJwk(
            didJwkDescriptor?.kid ?? crypto.randomUUID()
        );
        let value = Buffer.from(publicJwk.valueStr, "ascii").toString("base64");

        return new VCLDidJwk(`${VCLDidJwk.DidJwkPrefix}${value}`);
    }

    generateJwk = async () => {
        const keyPair = crypto.generateKeyPairSync("ec", {
            namedCurve: "secp256k1",
        });
        const publicKey = await exportJWK(keyPair.publicKey);
        return this.getDidUriFromJwk(publicKey);
    };

    jwkToPublicBase64Url = (json: JWK) => {
        let c = canonicalize(json);
        if (!c) {
            return "";
        }
        return base64url.encode(c);
    };

    getDidUriFromJwk = (publicJwk: JWK) => {
        const publicKey = this.jwkToPublicBase64Url(publicJwk);
        return util.format("did:jwk:%s", publicKey);
    };

    private generateJwkSECP256K1(kid: string) {
        const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
            namedCurve: "secp256k1",
        });

        return {
            async toPublicJWK() {
                const publicJwk = await exportJWK(publicKey);
                publicJwk.kid = kid;
                publicJwk.p;
                return publicJwk;
            },
            publicKey,
            privateKey,
        };
    }

    private async generatePublicJwk(kid: string) {
        let publicJwk = await this.generateJwkSECP256K1(kid).toPublicJWK();
        return VCLPublicJwk.fromJSON(publicJwk);
    }
}
 */
