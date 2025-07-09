# Introduction

This package is meant to be a centralized place for all math functions to be exposed. 
Wherever number overflow or floating point errors is a concern, these functions should be used.

To use the functions, the numbers need to be converted to BigNumbers, using the exposed `toBigNumber` and `fromBigNumber` functions.

Once the numbers are converted to BigNumbers, then functions are exposed to perform operations on those BigNumbers.

For example:
* `addBigNumbers(m,n)`
* `subtractBigNumbers(m,n)`
* `multiplyBigNumbers(m,n)`
* `divideBigNumbers(m,n)`