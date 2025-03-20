SHELL := /bin/bash

D_PS = $(shell docker ps -aq)
D_IMG = $(shell docker images -q)
OF = game

DOCKER_COMPOSE = docker-compose -f ./srcs/docker-compose.yml

DC_RUN_GAME= run --rm game sh -c
DC_RUN_USER= run --rm user-mgmt sh -c


CERTS_DIR= ./srcs/certs/
ENV= ./srcs/.env
CONF_DIR= ./srcs/conf/
SECURE ?= false

all: build mi fill up

build: env
	@$(DOCKER_COMPOSE) build

secure: certs
	@$(MAKE) --no-print-directory build SECURE=true

env:
	@if [ "$(SECURE)" = "true" ]; then \
		cp $(CONF_DIR).env.secure $(ENV); \
		cp $(CONF_DIR)nginx_secure.conf srcs/front/conf/nginx.conf; \
		cp $(CONF_DIR)Dockerfile_game.secure srcs/back/game/Dockerfile; \
		cp $(CONF_DIR)Dockerfile_usermgmt.secure srcs/back/user_mgmt/Dockerfile; \
		IP_ADDRESS=$$(hostname -I | awk '{print $$1}'); \
	else \
		mkdir -p $(CERTS_DIR); \
		cp $(CONF_DIR).env.dev $(ENV); \
		cp $(CONF_DIR)nginx_dev.conf srcs/front/conf/nginx.conf; \
		cp $(CONF_DIR)Dockerfile_game.dev srcs/back/game/Dockerfile; \
		cp $(CONF_DIR)Dockerfile_usermgmt.dev srcs/back/user_mgmt/Dockerfile; \
		IP_ADDRESS=localhost; \
	fi; \
	sed -i '/^HOST=/d' $(ENV); \
	echo "HOST=$$IP_ADDRESS" >> $(ENV); \
	sed -i '/^REDIRECT_URI=/d' $(ENV); \
	echo "REDIRECT_URI=$$( [ "$(SECURE)" = "true" ] && echo "https" || echo "http")://$$IP_ADDRESS:8443/callback" >> $(ENV);

certs:
	@mkdir -p $(CERTS_DIR)
	@openssl genrsa -out $(CERTS_DIR)/key.pem 4096 && \
	openssl req -x509 -key $(CERTS_DIR)/key.pem -out $(CERTS_DIR)/crt.pem -subj "/C=ES/ST=Barcelona/O=BubblePong/CN=user-mgmt"

up:
	docker-compose -f ./srcs/docker-compose.yml up --detach --remove-orphans

mi:
	@echo "Running Migrations..."
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py makemigrations"
	@$(DOCKER_COMPOSE) $(DC_RUN_USER) "python manage.py makemigrations"
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py migrate"
	@$(DOCKER_COMPOSE) $(DC_RUN_USER) "python manage.py migrate"

fill:
	@$(DOCKER_COMPOSE) $(DC_RUN_USER) "python manage.py shell < createUserList.py"
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py shell < createGameList.py"

#stop -> stops services
stop:
	docker-compose -f ./srcs/docker-compose.yml stop

#down -> stops and removes containers and networks
down:
	docker-compose -f ./srcs/docker-compose.yml down

clean: down
	docker-compose -f ./srcs/docker-compose.yml rm 

ps:
	docker-compose -f ./srcs/docker-compose.yml ps

logs:
	docker logs -f --since 5m ${OF}

back:
	docker restart ${OF}

mgmt:
	docker restart user-mgmt

fclean: down
	@if [ -n "$(D_PS)" ]; then \
		echo "deleting containers"; \
		docker stop $(D_PS); \
		docker rm $(D_PS); \
	fi
	@if [ -n "$(D_IMG)" ]; then \
		echo "deleting images"; \
		docker rmi $(D_IMG); \
	fi
	@if [ -n "$$(docker volume ls -q --filter dangling=true)" ]; then \
		echo "deleting volumes"; \
		docker volume rm $$(docker volume ls -q --filter dangling=true); \
		docker system prune -a --volumes; \
		echo "volumes deleted"; \
	fi
	@if [ -d ./srcs/postgres ]; then \
		rm -rf ./srcs/postgres/*; \
	fi

re: fclean all mi up

.SILENT: all build secure up mi fill clean fclean