# TS Schema Generator

TS Schema Generator is a tool that generates code out of your PostgreSQL database. Whether you are developing a frontend or backend, you can utilize this tool to generate TypeScript interface definitions

### Quick Start

Install using `yarn`:

    $ yarn add -D @ts-schema-generator/{cli, typescript}

create a basic `tsg.config.js` configuration file, point to your schema, and pick the plugins you wish to use. For example:

```
const path = require("path");
require("dotenv").config();

module.exports = {
  uri: process.env.DATABASE_URI,
  plugins: [
    { name: "typescript", filepath: path.join(process.cwd(), "generated.ts") },
  ]
};
```

Then, run the generator using `tsg` command:

    $ yarn tsg

The command above may fetch (for example) the following Database schema:

```sql
CREATE TABLE country
(
    value   text NOT NULL
        CONSTRAINT country_pkey
            PRIMARY KEY,
    comment text
);
```

And generate the following TypeScript typings:

```
interface Country {
  value: string;
  comment?: string | null;
}
export interface CountrySelect extends SetRequired<Country> {}
export interface CountryInsert extends Country {}
export interface CountryUpdate extends Partial<Country> {}
```

### 1.0.0 TODO

- [ ] add documentation
- [ ] improve configuration
- [ ] improve plugins
- [ ] website
- [ ] lifecycle hooks
- [ ] add more plugins
- [ ] integrated other SQL Database
