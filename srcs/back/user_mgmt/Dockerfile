FROM python:3.11

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application code into the container
COPY . .

#RUN chmod 777 entrypoint.sh

# Expose the default port for Django
EXPOSE 8000

#ENTRYPOINT ["./entrypoint.sh"]

# Run the Django application
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
