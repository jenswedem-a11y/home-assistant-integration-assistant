FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Device catalog: built from the versioned seed into a read-only SQLite file.
COPY database ./database
COPY tools ./tools
RUN python3 tools/catalog.py build

COPY app ./app

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
