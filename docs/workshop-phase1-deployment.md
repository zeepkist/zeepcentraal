# Workshop Phase 1 Deployment

1. Apply database migrations before deploying GTR `1.0.0`.
2. Verify migration `0027` set every version gate:

```sql
SELECT minimum FROM version;
```

Every returned `minimum` must equal `1.0.0`.

3. Deploy server and jobs images.
4. Verify jobs environment contains `STEAM_API_KEY`, `STEAM_APP_ID`, and S3 credentials.
5. Deploy GTR `1.0.0`.
6. Trigger `syncWorkshopCatalog` or wait for Sunday `01:00 Europe/London`.
7. Review failed `scanWorkshopItem` jobs before approving Phase 2.
