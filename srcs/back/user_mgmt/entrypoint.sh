#!/bin/sh

# if [ "$DATABASE_HOST" = "postgres" ]
# then
#     echo "Waiting for postgres..."

#     while ! nc -z $DATABASE_HOST $DATABASE_PORT; do
#       sleep 0.1
#     done

#     echo "PostgreSQL started"
# fi

python3 manage.py makemigrations
python3 manage.py migrate

python3 manage.py shell < createUserList.py
exec "$@"