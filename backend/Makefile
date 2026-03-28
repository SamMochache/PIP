# Convenience commands — run: make <target>

.PHONY: help install migrate dev celery superuser shell

help:
	@echo "Available commands:"
	@echo "  make install    — install Python dependencies"
	@echo "  make infra      — start PostgreSQL + Redis (Docker)"
	@echo "  make migrate    — run database migrations"
	@echo "  make dev        — start the Django dev server (ASGI/Daphne)"
	@echo "  make celery     — start the Celery worker"
	@echo "  make superuser  — create a Django admin user"
	@echo "  make shell      — open Django shell"

install:
	pip install -r requirements.txt

infra:
	docker-compose up -d

migrate:
	python manage.py makemigrations
	python manage.py migrate

dev:
	# Daphne is the ASGI server — handles both HTTP and WebSockets
	daphne -b 0.0.0.0 -p 8000 core.asgi:application

celery:
	celery -A core.celery worker --loglevel=info

superuser:
	python manage.py createsuperuser

shell:
	python manage.py shell_plus 2>/dev/null || python manage.py shell
