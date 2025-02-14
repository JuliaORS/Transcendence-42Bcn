
#-f flag -> specify the name and path of one or more compose files
#-d detach -> run containers in the background

SHELL := /bin/bash

D_PS = $(shell docker ps -aq)
D_IMG = $(shell docker images -q)
OF = game
#D_VOL = $(shell docker volume ls -q --filter dangling=true)
# Macros
# DOCKER_COMPOSE = docker compose
DOCKER_COMPOSE = docker-compose -f ./srcs/docker-compose.yml

DC_RUN_GAME= run --rm game sh -c
DC_RUN_USER= run --rm user-mgmt sh -c

all: build mi fill up

build:
	@$(DOCKER_COMPOSE) build 
# @$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py wait_for_db"
# # @$(DOCKER_COMPOSE) $(DC_RUN_USER) "python manage.py wait_for_db"

#up -> pulls base image, builds image, starts services
up:
	docker-compose -f ./srcs/docker-compose.yml up --detach --remove-orphans

mi:
	@echo "Running Migrations..."
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py makemigrations"
	@$(DOCKER_COMPOSE) $(DC_RUN_USER) "python manage.py makemigrations"
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py migrate"
	@$(DOCKER_COMPOSE) $(DC_RUN_USER) "python manage.py migrate"

fill:
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py shell < createUserList.py"
	@$(DOCKER_COMPOSE) $(DC_RUN_GAME) "python manage.py shell < createGameList.py"

#stop -> stops services
stop:
	docker-compose -f ./srcs/docker-compose.yml stop

#down -> stops and removes containers and networks
down:
	docker-compose -f ./srcs/docker-compose.yml down

#rm -> removes stopped service containers
clean: down
	docker-compose -f ./srcs/docker-compose.yml rm 

ps:
	docker-compose -f ./srcs/docker-compose.yml ps

logs:
	docker logs -f ${OF}

back:
	docker restart ${OF}

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
#docker system prune --all --force --volumes


re: fclean all mi up

.SILENT: all build up stop down ps clean fclean
