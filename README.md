# card_game

## Testing

```sh
npm test              # everything
npm run test:unit     # rules, CPU logic, whole-match simulations
npm run test:server   # engine, real sockets, database
npm run test:ui       # table components (jsdom)
npm run test:watch    # re-run on save
npm run coverage      # coverage report in coverage/
```

- `tests/unit` and `tests/integration` run every rule against both copies of the
  logic (`src/utils` and `server/game`), so the two can't drift apart.
- `server/tests/socket.test.js` starts its own server on a free port. Nothing
  else needs to be running.
- The database suites (`server/tests/db`) run only when `TEST_DATABASE_URL` is set,
  in the environment or in `server/.env`. They wipe that database, so point it at
  a throwaway one:

  ```sh
  podman exec khuzur-db psql -U khuzur -c "create database khuzur_test owner khuzur"
  ```

