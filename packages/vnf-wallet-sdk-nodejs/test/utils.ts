const normalizeUri = (uri: string): string => {
    const url = new URL(uri);

    // Normalize the scheme and host
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    // Sort and decode query parameters
    const queryParams = new URLSearchParams(url.search);
    const sortedAndDecodedParams = new URLSearchParams();
    Array.from(queryParams.keys())
        .sort()
        .forEach((key) => {
            sortedAndDecodedParams.set(
                key,
                decodeURIComponent(queryParams.get(key) as string)
            );
        });
    url.search = sortedAndDecodedParams.toString();

    return url.toString();
};

export const isEquivalentUris = (uri1: string, uri2: string): boolean =>
    normalizeUri(uri1) === normalizeUri(uri2);
