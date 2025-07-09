# Description
This package contains
* [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1)
  country data
* [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2)
  subdivision data
* country phone codes according to 
  [country.io/phone.json](http://country.io/phone.json)

#Usage
Package exposes `getCountries` which takes an 
[`ISO 639-1`](https://en.wikipedia.org/wiki/ISO_639-1)
(2-letter) country code as a parameter, to control what
language the name of the country and its regions are
returned in