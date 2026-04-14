e2e:
	docker-compose -f docker-compose.e2e.yml build e2e && docker-compose -f docker-compose.e2e.yml run --rm e2e

.PHONY: e2e
