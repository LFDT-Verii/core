## Credentialing Hub

Credentialing Hub runtime code is maintained in this package.

## Design Docs

- [Notification webhooks design](docs/notification-webhooks-design.md)

## Data Migrations

Credentialing Hub database migrations remain in the monorepo Docker/wrapper package under `servers/credentialinghub/migrations`.

Run migrations from the monorepo image:

```sh
docker run --name credentialinghub-migrations -e MONGO_URI=**** ghcr.io/velocitynetworkfoundation/credentialinghub:latest sh -c "cd servers/credentialinghub && pnpm migrate:up"
```
