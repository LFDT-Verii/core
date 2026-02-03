export class CredentialTypesMocks {
    static readonly CredentialType1: string = `
    {
        "credentialType": "EducationDegree",
        "schemaName": "education-degree",
        "recommended": false,
        "id": "5fe4a315d8b45dd2e80bd739",
        "createdAt": "2022-03-17T09:24:38.448Z",
        "updatedAt": "2022-03-17T09:24:38.448Z"
    }`;

    static readonly CredentialType2: string = `
    {
        "credentialType": "CurrentEmploymentPosition",
        "schemaName": "current-employment-position",
        "recommended": true,
        "id": "5fe4a315d8b45dd2e80bd73a",
        "createdAt": "2022-03-17T09:24:38.448Z",
        "updatedAt": "2022-03-17T09:24:38.448Z"
    }`;

    static readonly CredentialType3: string = `
    {
        "credentialType": "PastEmploymentPosition",
        "schemaName": "past-employment-position",
        "recommended": false,
        "id": "5fe4a315d8b45dd2e80bd73b",
        "createdAt": "2022-03-17T09:24:38.448Z",
        "updatedAt": "2022-03-17T09:24:38.448Z"
    }`;

    static readonly CredentialTypesJsonStr: string = `[${CredentialTypesMocks.CredentialType1}, ${CredentialTypesMocks.CredentialType2}, ${CredentialTypesMocks.CredentialType3}]`;
}
