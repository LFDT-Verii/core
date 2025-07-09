# Introduction
The package contains the minimum starting point, 
of what defines a package for us.

# New Package Creation Instructions

## Steps

1. This directory should be copied and renamed to the package name. 
   The `"name"` field in the `package.json` should be updated to match 
   the directory name, prefixed by `@verii` as 
   seen by the `template-package` name:
   `"@verii/template-package"`

1. A description should be added in the `"description"` field 
   in the `package.json`

1. This `README.md` should be cleared and used for relevant 
   information in the new package.

## Some points to take note of:

* `"repository"` field in `package.json` is important and is used 
  later when we setup scopes with [`lerna`](https://lerna.js.org/)

* They packages actually get published, but we don't consume the 
  packages directly from their publish location, instead we rely 
  on `lerna` cli within the repository like so:
  
  `lerna add [CONSUMED-PACKAGE-NAME] --scope [CONSUMING-PACKAGE-NAME]`

  So if you want `did-docs` package to use the `crypto` package, 
  you would do:
  
  `lerna add @verii/crypto --scope @verii/did-docs`

* Packages uses standard structure, of `src` directory, 
  and then `test` directory for corresponding tests

* Tests can be run from `package.json` script

* Tests will be automatically included in global test suite and run in CI