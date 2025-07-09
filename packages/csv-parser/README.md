# csv-parser

The package contains tools for converting json to csv.

### Example 1

```js
const {parseToCsv} = require('@verii/csv-parser');

const json = [
  {
    name: 'John',
    age: 30,
    city: 'New York',
  },
];

const fields = [
  {
    fieldName: 'Name',
    fieldValue: 'name',
  }
];

const csv = parseToCsv(json);
```

### Example 2

```js
const {parseToCsv} = require('@verii/csv-parser');

const json = [
  {
    person: {
      name: 'John',
      age: 30,
      city: 'New York',
    },
  },
];

const fields = [
  {
    fieldName: 'Name',
    fieldValue: 'person.name',
  },
  {
    fieldName: 'Age',
    fieldValue: (item) => item.person.age,
  },
];

const csv = parseToCsv(json);
```