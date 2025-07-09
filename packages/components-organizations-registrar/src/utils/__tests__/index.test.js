import { webSiteRegexp, formatWebSiteUrl, formatRegistrationNumbers } from '../index.jsx';

const validURLs = ['https://www.example.com', 'http://www.example.com', 'www.example.com'];
const inValidURLs = [
  'example.com',
  'www.example',
  'www.example.',
  'https:example.com',
  'https://www.exa mple.com',
];
const validURLsFormated = [
  'https://www.example.com',
  'http://www.example.com',
  'https://www.example.com',
];
const registrationNumbersWithURI = [
  {
    number: '123456',
    uri: 'www.example.com',
  },
  {
    number: '123456',
  },
];
const registrationNumbersWithURIFormated = [
  {
    number: '123456',
    uri: 'https://www.example.com',
  },
  {
    number: '123456',
  },
];

describe('validate and format organization website url', () => {
  it('should match valid website url', () => {
    validURLs.forEach((url) => expect(webSiteRegexp.test(url)).toBe(true));
    inValidURLs.forEach((url) => expect(webSiteRegexp.test(url)).toBe(false));
  });
  it('should format website url', () => {
    validURLs.forEach((url, index) => expect(formatWebSiteUrl(url)).toBe(validURLsFormated[index]));
  });
  it('should format registration numbers when empty array', () => {
    expect(formatRegistrationNumbers([])).toEqual([]);
  });
  it('should format registration numbers when uri presents', () => {
    expect(formatRegistrationNumbers(registrationNumbersWithURI)).toEqual(
      registrationNumbersWithURIFormated,
    );
  });
});
