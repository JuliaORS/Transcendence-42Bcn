FROM python:3.11

# Set the working directory
WORKDIR /usr/src/app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code
COPY . .

#RUN chmod 777 entrypoint.sh

# Set Python to unbuffered mode
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=game.settings

# Expose the application port (adjust according to your app's port)
EXPOSE 8001

#ENTRYPOINT ["./entrypoint.sh"]

CMD ["daphne", "-b", "0.0.0.0", "-p", "8001", "game.asgi:application"]
#CMD ["daphne", "-b", "0.0.0.0", "-p", "8001", "--verbosity", "3", "game.asgi:application"]

# Start the application
#CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]
#CMD ["python", "manage.py", "runserver_plus", "0.0.0.0:8001"]
