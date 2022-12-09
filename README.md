# Nieuwsberichten migration service

## Add the nieuwsberichten migration service to your stack temporarily

``` yaml
nieuwsberichten-migration-service:
  build: https://github.com/kanselarij-vlaanderen/nieuwsberichten-migration-service.git
  environment:
    NODE_ENV: "development"
  links:
    - triplestore:database
```

The service is finished when the logs say: `Finished migrating news items`
